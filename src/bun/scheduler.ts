import type { RepeatInterval, RunRecord } from "../shared/types";
import { projectPaths } from "./config";
import { createRun, getPendingScheduledRuns, updateRunStatus } from "./db/history";

export type TriggerRun = (
  projectPath: string,
  runId: string,
  formSlug: string,
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
    console.log(`[scheduler] Running late scheduled form: ${run.formSlug}`);
  }
  trigger?.(projectPath, run.id, run.formSlug, run.inputs);

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
      formSlug: run.formSlug,
      inputs: run.inputs,
      status: "scheduled",
      startedAt: new Date().toISOString(),
      scheduledAt: next.toISOString(),
      repeatInterval: run.repeatInterval,
    });
    arm(projectPath, created);
  }
}

/** Persist a new scheduled run and arm its timer. */
export function schedule(
  projectPath: string,
  formSlug: string,
  inputs: Record<string, unknown>,
  scheduledAt: string,
  repeatInterval: RepeatInterval,
): string {
  const id = crypto.randomUUID();
  const run = createRun(projectPath, {
    id,
    formSlug,
    inputs,
    status: "scheduled",
    startedAt: new Date().toISOString(),
    scheduledAt,
    repeatInterval,
  });
  arm(projectPath, run);
  return id;
}

export function cancelScheduled(runId: string): void {
  const t = timers.get(runId);
  if (t) {
    clearTimeout(t);
    timers.delete(runId);
  }
  updateRunStatus(runId, "error", null, new Date().toISOString());
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
