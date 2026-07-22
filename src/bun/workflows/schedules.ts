import type { RepeatInterval, ScheduledWorkflowRun, WorkflowRunTriggerInfo } from "../../shared/types";
import { ensureDir, projectScheduledWorkflowsPath, projectWorkflowsDir } from "../paths";

/**
 * Calendar workflow scheduling (ticket 117) — same one-timer-per-item model
 * as scheduler.ts (task schedules), kept as its own module since workflow
 * schedules persist as JSON here rather than a SQLite row: workflow state
 * generally (definitions, runs) already lives on disk as JSON, not in
 * history.db, and reusing that column-shaped table would mean widening its
 * NOT NULL task-slug column for a row that has no task — the exact class of
 * bug ticket 114 fixed. Keeping the two schedule kinds in parallel stores
 * avoids reintroducing it.
 */
export type WorkflowScheduleStarter = (
  projectPath: string,
  projectName: string,
  workflowId: string,
  trigger: WorkflowRunTriggerInfo,
) => void;

const timers = new Map<string, ReturnType<typeof setTimeout>>();
let starter: WorkflowScheduleStarter | null = null;

const MAX_DELAY = 2_147_483_647; // setTimeout ceiling (~24.8 days)

function isScheduledWorkflowRun(v: unknown): v is ScheduledWorkflowRun {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.workflowId === "string" &&
    typeof o.workflowName === "string" &&
    typeof o.scheduledAt === "string" &&
    isObject(o.params)
  );
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Disk format firewall (ticket 129): older entries predate `skipDates` — default to none. */
function normalizeSchedule(item: ScheduledWorkflowRun): ScheduledWorkflowRun {
  if (Array.isArray(item.skipDates)) return item;
  return { ...item, skipDates: [] };
}

async function readSchedules(projectPath: string): Promise<ScheduledWorkflowRun[]> {
  try {
    const file = Bun.file(projectScheduledWorkflowsPath(projectPath));
    if (!(await file.exists())) return [];
    const parsed = JSON.parse(await file.text());
    return Array.isArray(parsed) ? parsed.filter(isScheduledWorkflowRun).map(normalizeSchedule) : [];
  } catch {
    return [];
  }
}

async function writeSchedules(projectPath: string, list: ScheduledWorkflowRun[]): Promise<void> {
  ensureDir(projectWorkflowsDir(projectPath));
  await Bun.write(projectScheduledWorkflowsPath(projectPath), JSON.stringify(list, null, 2));
}

function nextOccurrence(from: Date, interval: RepeatInterval): Date {
  const d = new Date(from);
  if (interval === "daily") d.setDate(d.getDate() + 1);
  else if (interval === "weekly") d.setDate(d.getDate() + 7);
  return d;
}

/** Steps forward from `base` past any occurrence that's already due or explicitly skipped (ticket 129). */
function advanceOccurrence(base: Date, interval: RepeatInterval, skipDates: string[]): Date {
  let next = nextOccurrence(base, interval);
  let guard = 0;
  while (guard < 1000 && (next.getTime() <= Date.now() || skipDates.includes(next.toISOString()))) {
    next = nextOccurrence(next, interval);
    guard++;
  }
  return next;
}

function clearTimer(id: string): void {
  const t = timers.get(id);
  if (t) {
    clearTimeout(t);
    timers.delete(id);
  }
}

function arm(projectPath: string, projectName: string, item: ScheduledWorkflowRun): void {
  const due = new Date(item.scheduledAt).getTime();
  const delay = due - Date.now();

  if (delay <= 0) {
    void fire(projectPath, projectName, item, true);
    return;
  }
  if (delay > MAX_DELAY) {
    timers.set(
      item.id,
      setTimeout(() => arm(projectPath, projectName, item), MAX_DELAY),
    );
    return;
  }
  timers.set(
    item.id,
    setTimeout(() => void fire(projectPath, projectName, item, false), delay),
  );
}

async function fire(projectPath: string, projectName: string, item: ScheduledWorkflowRun, late: boolean): Promise<void> {
  timers.delete(item.id);
  if (late) {
    console.log(`[workflow-scheduler] Running late scheduled workflow: ${item.workflowName}`);
  }
  starter?.(projectPath, projectName, item.workflowId, {
    type: "schedule",
    detail: item.workflowName,
    params: item.params,
  });

  const list = await readSchedules(projectPath);
  if (item.repeatInterval !== "none") {
    const next = advanceOccurrence(new Date(item.scheduledAt), item.repeatInterval, item.skipDates);
    const advanced: ScheduledWorkflowRun = {
      ...item,
      scheduledAt: next.toISOString(),
      // Carry forward still-future skips (ticket 129) — past ones are moot once their date has gone by.
      skipDates: item.skipDates.filter((d) => new Date(d).getTime() > Date.now()),
    };
    await writeSchedules(
      projectPath,
      list.map((s) => (s.id === item.id ? advanced : s)),
    );
    arm(projectPath, projectName, advanced);
  } else {
    await writeSchedules(projectPath, list.filter((s) => s.id !== item.id));
  }
}

/** Persist a new scheduled workflow run and arm its timer. */
export async function scheduleWorkflowRun(
  projectPath: string,
  projectName: string,
  workflowId: string,
  workflowName: string,
  params: Record<string, string>,
  scheduledAt: string,
  repeatInterval: RepeatInterval,
): Promise<string> {
  const id = crypto.randomUUID();
  const item: ScheduledWorkflowRun = { id, workflowId, workflowName, params, scheduledAt, repeatInterval, skipDates: [] };
  const list = await readSchedules(projectPath);
  await writeSchedules(projectPath, [...list, item]);
  arm(projectPath, projectName, item);
  return id;
}

/** Cancel a pending scheduled workflow run: clear its timer and remove it. */
export async function cancelScheduledWorkflowRun(projectPath: string, id: string): Promise<void> {
  clearTimer(id);
  const list = await readSchedules(projectPath);
  await writeSchedules(projectPath, list.filter((s) => s.id !== id));
}

/**
 * Delete one occurrence of a recurring scheduled workflow run rather than
 * the whole series (ticket 129) — mirrors `deleteOccurrence` in
 * scheduler.ts. If `occurrenceAt` is the item's own pending fire time, it's
 * advanced to its next occurrence instead of removed. Otherwise
 * `occurrenceAt` names a not-yet-materialized future occurrence; it's
 * recorded in `skipDates` so the projector stops offering it. Returns false
 * if the item isn't a pending recurring schedule.
 */
export async function deleteWorkflowOccurrence(
  projectPath: string,
  projectName: string,
  id: string,
  occurrenceAt: string,
): Promise<boolean> {
  const list = await readSchedules(projectPath);
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  const item = list[idx]!;
  if (item.repeatInterval === "none") return false;

  if (new Date(occurrenceAt).getTime() === new Date(item.scheduledAt).getTime()) {
    clearTimer(id);
    const next = advanceOccurrence(new Date(item.scheduledAt), item.repeatInterval, item.skipDates);
    const advanced: ScheduledWorkflowRun = { ...item, scheduledAt: next.toISOString() };
    const nextList = [...list];
    nextList[idx] = advanced;
    await writeSchedules(projectPath, nextList);
    arm(projectPath, projectName, advanced);
    return true;
  }

  const skipDates = item.skipDates.includes(occurrenceAt) ? item.skipDates : [...item.skipDates, occurrenceAt];
  const updated: ScheduledWorkflowRun = { ...item, skipDates };
  const nextList = [...list];
  nextList[idx] = updated;
  await writeSchedules(projectPath, nextList);
  return true;
}

/** Change a pending schedule's fire time/repeat and re-arm its timer. Returns false if it no longer exists. */
export async function rescheduleWorkflowRun(
  projectPath: string,
  projectName: string,
  id: string,
  scheduledAt: string,
  repeatInterval: RepeatInterval,
): Promise<boolean> {
  const list = await readSchedules(projectPath);
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  clearTimer(id);
  const updated: ScheduledWorkflowRun = { ...list[idx]!, scheduledAt, repeatInterval };
  const next = [...list];
  next[idx] = updated;
  await writeSchedules(projectPath, next);
  arm(projectPath, projectName, updated);
  return true;
}

/** Fire a pending scheduled workflow run immediately, bypassing its timer. Returns false if it no longer exists. */
export async function runScheduledWorkflowRunNow(projectPath: string, projectName: string, id: string): Promise<boolean> {
  const list = await readSchedules(projectPath);
  const item = list.find((s) => s.id === id);
  if (!item) return false;
  clearTimer(id);
  await fire(projectPath, projectName, item, false);
  return true;
}

export async function getScheduledWorkflows(projectPath: string): Promise<ScheduledWorkflowRun[]> {
  return readSchedules(projectPath);
}

/**
 * Persist a scheduled workflow run without arming a live timer (ticket 127).
 * For dev-profile fixtures (scripts/seed-profile.ts): the seeder is a
 * one-shot script that must exit promptly, and `scheduleWorkflowRun`'s
 * `arm()` would set a real `setTimeout`, keeping the process alive until it
 * fires (the same class of hang ticket 114 fixed for the task scheduler).
 * The running app picks these up normally via `initWorkflowSchedules` on
 * next launch.
 */
export async function seedScheduledWorkflowRun(projectPath: string, item: ScheduledWorkflowRun): Promise<void> {
  const list = await readSchedules(projectPath);
  await writeSchedules(projectPath, [...list, item]);
}

/** Initialise the workflow scheduler: load pending schedules from every project and arm timers. */
export async function initWorkflowSchedules(
  projects: { path: string; name: string }[],
  triggerStart: WorkflowScheduleStarter,
): Promise<void> {
  starter = triggerStart;
  for (const p of projects) {
    for (const item of await readSchedules(p.path)) arm(p.path, p.name, item);
  }
}

export function disposeWorkflowSchedules(): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
}

/** Count of armed workflow-schedule timers (ticket 124 diagnostics). */
export function armedWorkflowTimerCount(): number {
  return timers.size;
}
