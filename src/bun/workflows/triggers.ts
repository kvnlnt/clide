import type { Project, Workflow } from "../../shared/types";
import type { RunCompletionInfo } from "../runner/execute";
import { listWorkflows } from "./store";

// ---------------------------------------------------------------------------
// Workflow triggers (ticket 90). Triggers live on the workflow, never on
// tasks. Schedule triggers use a minimal cron subset (m h dom mon dow with
// numbers, *, ",", "-", "/") evaluated only while the app runs — no daemon,
// no back-fill. Task-submitted triggers fire when a STANDALONE run of the
// referenced task completes successfully; workflow-internal steps never
// cascade.
// ---------------------------------------------------------------------------

export type WorkflowStarter = (
  project: Project,
  workflow: Workflow,
  trigger: { type: "schedule" | "task-submitted"; detail?: string },
  triggerEnv: Record<string, unknown>,
) => void;

interface TriggerState {
  projects: Project[];
  /** `${projectPath}\0${taskSlug}` → workflows with a matching task-submitted trigger. */
  taskIndex: Map<string, { project: Project; workflow: Workflow }[]>;
  schedules: { project: Project; workflow: Workflow; cron: string; lastFiredMinute: number }[];
}

const state: TriggerState = { projects: [], taskIndex: new Map(), schedules: [] };
let starter: WorkflowStarter | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

// --- cron subset -------------------------------------------------------------

function parseField(field: string, min: number, max: number): Set<number> | null {
  const out = new Set<number>();
  for (const part of field.split(",")) {
    const [range, stepStr] = part.split("/");
    const step = stepStr !== undefined ? Number(stepStr) : 1;
    if (!Number.isInteger(step) || step < 1) return null;
    let lo: number;
    let hi: number;
    if (range === "*" || range === "") {
      lo = min;
      hi = max;
    } else if (range!.includes("-")) {
      const [a, b] = range!.split("-").map(Number);
      if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
      lo = a!;
      hi = b!;
    } else {
      const n = Number(range);
      if (!Number.isInteger(n)) return null;
      lo = hi = n;
    }
    if (lo < min || hi > max || lo > hi) return null;
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

/** Validates a cron expression against the supported subset; returns a human error or null. */
export function validateCron(expr: string): string | null {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return "cron needs 5 fields: minute hour day-of-month month day-of-week";
  const ranges: [number, number][] = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 6],
  ];
  for (let i = 0; i < 5; i++) {
    if (!parseField(fields[i]!, ranges[i]![0], ranges[i]![1])) return `invalid cron field "${fields[i]}"`;
  }
  return null;
}

function cronMatches(expr: string, date: Date): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const minute = parseField(fields[0]!, 0, 59);
  const hour = parseField(fields[1]!, 0, 23);
  const dom = parseField(fields[2]!, 1, 31);
  const month = parseField(fields[3]!, 1, 12);
  const dow = parseField(fields[4]!, 0, 6);
  if (!minute || !hour || !dom || !month || !dow) return false;
  return (
    minute.has(date.getMinutes()) &&
    hour.has(date.getHours()) &&
    dom.has(date.getDate()) &&
    month.has(date.getMonth() + 1) &&
    dow.has(date.getDay())
  );
}

// --- state -------------------------------------------------------------------

/** Rebuilds the trigger indexes from disk — call on startup and whenever workflows change. */
export async function refreshWorkflowTriggers(projects: Project[]): Promise<void> {
  state.projects = projects;
  const taskIndex = new Map<string, { project: Project; workflow: Workflow }[]>();
  const schedules: TriggerState["schedules"] = [];

  for (const project of projects) {
    for (const workflow of await listWorkflows(project.path)) {
      if (!workflow.enabled) continue;
      for (const trigger of workflow.triggers) {
        if (trigger.type === "task-submitted") {
          const key = `${project.path}\0${trigger.taskSlug}`;
          const list = taskIndex.get(key) ?? [];
          list.push({ project, workflow });
          taskIndex.set(key, list);
        } else if (trigger.type === "schedule") {
          if (validateCron(trigger.cron)) {
            console.warn(`[workflow] "${workflow.name}": invalid cron "${trigger.cron}" — trigger disabled.`);
            continue;
          }
          const prior = state.schedules.find((s) => s.workflow.id === workflow.id && s.cron === trigger.cron);
          schedules.push({ project, workflow, cron: trigger.cron, lastFiredMinute: prior?.lastFiredMinute ?? -1 });
        }
      }
    }
  }

  state.taskIndex = taskIndex;
  state.schedules = schedules;
}

/** Standalone task-run completion → start every matching enabled workflow (ticket 90). */
export function onTaskRunCompleted(info: RunCompletionInfo): void {
  if (!starter) return;
  const matches = state.taskIndex.get(`${info.projectPath}\0${info.taskSlug}`) ?? [];
  for (const { project, workflow } of matches) {
    const outputs: Record<string, unknown> = {};
    for (const o of info.outputs) if (o.ok) outputs[o.name] = o.value;
    starter(
      project,
      workflow,
      { type: "task-submitted", detail: info.taskSlug },
      { inputs: info.inputs, stdout: info.stdout, stderr: info.stderr, exitCode: info.exitCode, outputs },
    );
  }
}

/** Arms the schedule tick and registers the run starter. */
export function initWorkflowTriggers(start: WorkflowStarter): void {
  starter = start;
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    const now = new Date();
    const minuteKey = Math.floor(now.getTime() / 60_000);
    for (const sched of state.schedules) {
      if (sched.lastFiredMinute === minuteKey) continue;
      if (!cronMatches(sched.cron, now)) continue;
      sched.lastFiredMinute = minuteKey;
      starter?.(sched.project, sched.workflow, { type: "schedule", detail: sched.cron }, { params: {} });
    }
  }, 20_000);
}

export function disposeWorkflowTriggers(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
