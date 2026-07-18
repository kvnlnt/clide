import type { RepeatInterval, RunRecord } from "../shared/types";
import { projectPaths, resolveProjectByName } from "./config";
import {
  createRun,
  deleteRun,
  getPendingScheduledRuns,
  getRun,
  resolveRunProject,
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
    console.log(`[scheduler] Running late scheduled form: ${run.taskSlug}`);
  }
  trigger?.(projectPath, run.id, run.taskSlug, run.inputs);

  // Schedule the next occurrence for recurring runs.
  if (run.repeatInterval && run.repeatInterval !== "none") {
    const base = run.scheduledAt ? new Date(run.scheduledAt) : new Date();
    let next = nextOccurrence(base, run.repeatInterval);
    // Skip past any missed occurrences.
    while (next.getTime() <= Date.now()) {
      next = nextOccurrence(next, run.repeatInterval);
    }
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
