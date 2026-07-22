import type { RepeatInterval, RunRecord } from "../shared/types";
import { projectPaths, resolveProjectByName } from "./config";
import {
  createRun,
  deleteRun,
  getPendingScheduledRuns,
  getRun,
  resolveRunProject,
  setSkipDates,
  updateRunSchedule,
} from "./db/history";
import { loadTaskFolder } from "./tasks/loader";

export type TriggerRun = (
  projectPath: string,
  runId: string,
  taskSlug: string,
  inputs: Record<string, unknown>,
) => void;

const timers = new Map<string, ReturnType<typeof setTimeout>>();
let trigger: TriggerRun | null = null;

const MAX_DELAY = 2_147_483_647; // setTimeout ceiling (~24.8 days)

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

function clearTimer(runId: string): void {
  const t = timers.get(runId);
  if (t) {
    clearTimeout(t);
    timers.delete(runId);
  }
}

function arm(projectPath: string, run: RunRecord): void {
  if (!run.scheduledAt) return;
  const due = new Date(run.scheduledAt).getTime();
  const delay = due - Date.now();

  if (delay <= 0) {
    // Overdue — run now (covers "ran late" after the app was closed).
    fire(projectPath, run, true);
    return;
  }
  if (delay > MAX_DELAY) {
    // Too far out for a single timer; re-check when we get closer.
    const t = setTimeout(() => arm(projectPath, run), MAX_DELAY);
    timers.set(run.id, t);
    return;
  }
  const t = setTimeout(() => fire(projectPath, run, false), delay);
  timers.set(run.id, t);
}

function fire(projectPath: string, run: RunRecord, late: boolean): void {
  timers.delete(run.id);
  if (late) {
    console.log(`[scheduler] Running late scheduled task: ${run.taskSlug}`);
  }
  trigger?.(projectPath, run.id, run.taskSlug, run.inputs);

  // Schedule the next occurrence for recurring runs.
  if (run.repeatInterval && run.repeatInterval !== "none") {
    const base = run.scheduledAt ? new Date(run.scheduledAt) : new Date();
    const next = advanceOccurrence(base, run.repeatInterval, run.skipDates);
    const nextId = crypto.randomUUID();
    const created = createRun(projectPath, {
      id: nextId,
      taskSlug: run.taskSlug,
      inputs: run.inputs,
      status: "scheduled",
      startedAt: new Date().toISOString(),
      scheduledAt: next.toISOString(),
      repeatInterval: run.repeatInterval,
      taskVersion: run.taskVersion, // Keep the same version for recurring runs (ticket 105)
      // Carry forward still-future skips (ticket 129) — past ones are moot once their date has gone by.
      skipDates: run.skipDates.filter((d) => new Date(d).getTime() > Date.now()),
    });
    arm(projectPath, created);
  }
}

/** Persist a new scheduled run and arm its timer. */
export async function schedule(
  projectPath: string,
  taskSlug: string,
  inputs: Record<string, unknown>,
  scheduledAt: string,
  repeatInterval: RepeatInterval,
): Promise<string> {
  const id = crypto.randomUUID();

  // Load task to get current version (ticket 105: schedules created against "latest" pick up new versions).
  const project = await resolveProjectByName(projectPath);
  const projectName = project?.name ?? projectPath;
  const folder = await loadTaskFolder(projectPath, taskSlug, projectName);

  const run = createRun(projectPath, {
    id,
    taskSlug,
    inputs,
    status: "scheduled",
    startedAt: new Date().toISOString(),
    scheduledAt,
    repeatInterval,
    taskVersion: folder?.meta.version ?? 1, // Capture version at schedule-creation time
  });
  arm(projectPath, run);
  return id;
}

/**
 * Cancel a pending scheduled run: clear its timer and remove the row. A
 * scheduled run that never executed has no history value worth keeping, and
 * deleting it (rather than marking it "error") avoids reporting a run that
 * never ran as having failed.
 */
export function cancelScheduled(runId: string): void {
  clearTimer(runId);
  deleteRun(runId);
}

/**
 * Delete one occurrence of a recurring scheduled run rather than the whole
 * series (ticket 129). If `occurrenceAt` is the row's own pending fire
 * time, the row is advanced to its next occurrence instead of removed —
 * the series lives on. Otherwise `occurrenceAt` names a not-yet-materialized
 * future occurrence (a projected calendar chip); it's recorded in
 * `skip_dates` so the projector stops offering it, and the pending row is
 * left untouched. Returns false if the run isn't a pending recurring
 * schedule.
 */
export function deleteOccurrence(runId: string, occurrenceAt: string): boolean {
  const run = getRun(runId);
  if (!run || run.status !== "scheduled" || !run.scheduledAt || !run.repeatInterval || run.repeatInterval === "none") {
    return false;
  }
  const projectPath = resolveRunProject(runId);
  if (!projectPath) return false;

  if (new Date(occurrenceAt).getTime() === new Date(run.scheduledAt).getTime()) {
    clearTimer(runId);
    const next = advanceOccurrence(new Date(run.scheduledAt), run.repeatInterval, run.skipDates);
    updateRunSchedule(runId, next.toISOString(), run.repeatInterval);
    arm(projectPath, { ...run, scheduledAt: next.toISOString() });
    return true;
  }

  const skipDates = run.skipDates.includes(occurrenceAt) ? run.skipDates : [...run.skipDates, occurrenceAt];
  setSkipDates(runId, skipDates);
  return true;
}

/** Change a pending scheduled run's fire time/repeat and re-arm its timer. Returns false if the run isn't a pending schedule. */
export function rescheduleRun(runId: string, scheduledAt: string, repeatInterval: RepeatInterval): boolean {
  const projectPath = resolveRunProject(runId);
  const run = getRun(runId);
  if (!projectPath || !run || run.status !== "scheduled") return false;
  clearTimer(runId);
  updateRunSchedule(runId, scheduledAt, repeatInterval);
  arm(projectPath, { ...run, scheduledAt, repeatInterval });
  return true;
}

/** Fire a pending scheduled run immediately, bypassing its timer. Returns false if the run isn't a pending schedule. */
export function runScheduledNow(runId: string): boolean {
  const projectPath = resolveRunProject(runId);
  const run = getRun(runId);
  if (!projectPath || !run || run.status !== "scheduled") return false;
  clearTimer(runId);
  fire(projectPath, run, false);
  return true;
}

/** Initialise the scheduler: load pending runs from every project and arm timers. */
export async function initScheduler(triggerRun: TriggerRun): Promise<void> {
  trigger = triggerRun;
  const paths = await projectPaths();
  for (const { run, projectPath } of getPendingScheduledRuns(paths)) {
    arm(projectPath, run);
  }
}

export function disposeScheduler(): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
}

/** Count of armed task-schedule timers (ticket 124 diagnostics). */
export function armedTimerCount(): number {
  return timers.size;
}
