import type { RepeatInterval, RunRecord, ScheduledWorkflowRun, TaskFolder } from "../../types/tasks";

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MAX_CHIPS_PER_DAY = 4;
/** Hours shown in the Day/Week time-axis views (ticket 128) — full day, scrollable. */
export const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** `occurrenceAt` is the specific chip's date clicked — the real scheduled time for a solid chip, or a projected future date for a dashed one (ticket 129: needed to scope "delete this occurrence" correctly). */
export type Selected =
  | { kind: "task"; id: string; occurrenceAt: string }
  | { kind: "workflow"; id: string; occurrenceAt: string }
  | null;

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function startOfGrid(d: Date): Date {
  const s = startOfMonth(d);
  const grid = new Date(s);
  grid.setDate(grid.getDate() - s.getDay());
  return grid;
}

export function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - r.getDay());
  return r;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatHour(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? "am" : "pm"}`;
}

/** One calendar chip — a task run or a scheduled workflow (ticket 117), visually distinguished. */
export type Chip =
  | { key: string; date: Date; projected: boolean; kind: "task"; item: RunRecord }
  | { key: string; date: Date; projected: boolean; kind: "workflow"; item: ScheduledWorkflowRun };

/** Computes visual-only future occurrences of a recurring schedule within a date range, excluding any explicitly deleted (ticket 129). */
export function projectOccurrences(
  scheduledAt: string,
  repeatInterval: RepeatInterval,
  rangeStart: Date,
  rangeEnd: Date,
  skipDates: string[] = [],
): Date[] {
  if (!repeatInterval || repeatInterval === "none") return [];
  const stepDays = repeatInterval === "daily" ? 1 : 7;
  let current = addDays(new Date(scheduledAt), stepDays);
  const occurrences: Date[] = [];
  let guard = 0;
  while (current < rangeStart && guard < 1000) {
    current = addDays(current, stepDays);
    guard++;
  }
  while (current <= rangeEnd && guard < 2000) {
    if (!skipDates.includes(current.toISOString())) occurrences.push(current);
    current = addDays(current, stepDays);
    guard++;
  }
  return occurrences;
}

export interface ChipFilter {
  tasks: boolean;
  workflows: boolean;
}

/** Builds the full chip set (real + projected) across [rangeStart, rangeEnd], grouped by ISO date. */
export function buildChipsByDay(
  scheduledTasks: RunRecord[],
  scheduledWorkflows: ScheduledWorkflowRun[],
  rangeStart: Date,
  rangeEnd: Date,
  filter: ChipFilter,
): Map<string, Chip[]> {
  const map = new Map<string, Chip[]>();
  const push = (chip: Chip) => {
    const key = isoDate(chip.date);
    const list = map.get(key) ?? [];
    list.push(chip);
    map.set(key, list);
  };
  if (filter.tasks) {
    for (const run of scheduledTasks) {
      if (!run.scheduledAt) continue;
      push({ key: `${run.id}-real`, date: new Date(run.scheduledAt), projected: false, kind: "task", item: run });
      for (const occ of projectOccurrences(
        run.scheduledAt,
        run.repeatInterval ?? "none",
        rangeStart,
        rangeEnd,
        run.skipDates,
      )) {
        push({ key: `${run.id}-${occ.getTime()}`, date: occ, projected: true, kind: "task", item: run });
      }
    }
  }
  if (filter.workflows) {
    for (const sw of scheduledWorkflows) {
      push({ key: `${sw.id}-real`, date: new Date(sw.scheduledAt), projected: false, kind: "workflow", item: sw });
      for (const occ of projectOccurrences(sw.scheduledAt, sw.repeatInterval, rangeStart, rangeEnd, sw.skipDates)) {
        push({ key: `${sw.id}-${occ.getTime()}`, date: occ, projected: true, kind: "workflow", item: sw });
      }
    }
  }
  for (const list of map.values()) list.sort((a, b) => a.date.getTime() - b.date.getTime());
  return map;
}

/** Flat chronological chip list for the Agenda view (ticket 128) — no day bucketing, no per-day cap. */
export function buildAgendaChips(
  scheduledTasks: RunRecord[],
  scheduledWorkflows: ScheduledWorkflowRun[],
  rangeStart: Date,
  rangeEnd: Date,
  filter: ChipFilter,
): Chip[] {
  const byDay = buildChipsByDay(scheduledTasks, scheduledWorkflows, rangeStart, rangeEnd, filter);
  const flat: Chip[] = [];
  for (const list of byDay.values()) flat.push(...list);
  flat.sort((a, b) => a.date.getTime() - b.date.getTime());
  return flat;
}

export function chipName(chip: Chip, tasksBySlug: Map<string, TaskFolder>): string {
  return chip.kind === "task" ? (tasksBySlug.get(chip.item.taskSlug)?.meta.name ?? chip.item.taskSlug) : chip.item.workflowName;
}

/** The recurrence of the underlying scheduled item, real or projected occurrence alike. */
export function chipRepeat(chip: Chip): RepeatInterval {
  return chip.kind === "task" ? (chip.item.repeatInterval ?? "none") : chip.item.repeatInterval;
}
