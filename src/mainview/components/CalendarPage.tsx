import { ChevronLeft, ChevronRight, Play, Plus, Trash2, Workflow as WorkflowIcon, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import CalendarComposer from "./CalendarComposer";
import Modal from "./Modal";
import MonthYearPicker from "./MonthYearPicker";
import { useUIFeedback } from "./UIFeedback";
import type { RepeatInterval, RunRecord, ScheduledWorkflowRun } from "../types/tasks";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS_PER_DAY = 4;

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfGrid(d: Date): Date {
  const s = startOfMonth(d);
  const grid = new Date(s);
  grid.setDate(grid.getDate() - s.getDay());
  return grid;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** One calendar chip — a task run or a scheduled workflow (ticket 117), visually distinguished. */
type Chip =
  | { key: string; date: Date; projected: boolean; kind: "task"; item: RunRecord }
  | { key: string; date: Date; projected: boolean; kind: "workflow"; item: ScheduledWorkflowRun };

/** Computes visual-only future occurrences of a recurring schedule within a date range. */
function projectOccurrences(scheduledAt: string, repeatInterval: RepeatInterval, rangeStart: Date, rangeEnd: Date): Date[] {
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
    occurrences.push(current);
    current = addDays(current, stepDays);
    guard++;
  }
  return occurrences;
}

export default function CalendarPage() {
  const {
    activeProject,
    runs,
    tasksBySlug,
    updateScheduledRun,
    runScheduledNow,
    deleteRun,
    scheduledWorkflows,
    rescheduleWorkflowRun,
    runScheduledWorkflowRunNow,
    cancelScheduledWorkflowRun,
  } = useApp();
  const { confirm, toast } = useUIFeedback();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<
    { kind: "task"; id: string } | { kind: "workflow"; id: string } | null
  >(null);
  /** Day being composed for (ticket 69). Composer and ScheduleDetail are mutually exclusive. */
  const [composeDate, setComposeDate] = useState<Date | null>(null);

  const openComposer = (day: Date) => {
    setSelected(null);
    setComposeDate(day);
  };

  const openDetail = (chip: Chip) => {
    setComposeDate(null);
    setSelected(chip.kind === "task" ? { kind: "task", id: chip.item.id } : { kind: "workflow", id: chip.item.id });
  };

  const scheduledTasks = useMemo(
    () => runs.filter((r) => r.status === "scheduled" && tasksBySlug.get(r.taskSlug)?.meta.project === activeProject),
    [runs, tasksBySlug, activeProject],
  );

  const gridStart = useMemo(() => startOfGrid(month), [month]);
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);
  const rangeEnd = days[days.length - 1]!;

  const chipsByDay = useMemo(() => {
    const map = new Map<string, Chip[]>();
    const push = (chip: Chip) => {
      const key = isoDate(chip.date);
      const list = map.get(key) ?? [];
      list.push(chip);
      map.set(key, list);
    };
    for (const run of scheduledTasks) {
      if (!run.scheduledAt) continue;
      push({ key: `${run.id}-real`, date: new Date(run.scheduledAt), projected: false, kind: "task", item: run });
      for (const occ of projectOccurrences(run.scheduledAt, run.repeatInterval ?? "none", gridStart, rangeEnd)) {
        push({ key: `${run.id}-${occ.getTime()}`, date: occ, projected: true, kind: "task", item: run });
      }
    }
    for (const sw of scheduledWorkflows) {
      push({ key: `${sw.id}-real`, date: new Date(sw.scheduledAt), projected: false, kind: "workflow", item: sw });
      for (const occ of projectOccurrences(sw.scheduledAt, sw.repeatInterval, gridStart, rangeEnd)) {
        push({ key: `${sw.id}-${occ.getTime()}`, date: occ, projected: true, kind: "workflow", item: sw });
      }
    }
    return map;
  }, [scheduledTasks, scheduledWorkflows, gridStart, rangeEnd]);

  const selectedTask = selected?.kind === "task" ? scheduledTasks.find((r) => r.id === selected.id) : undefined;
  const selectedWorkflow =
    selected?.kind === "workflow" ? scheduledWorkflows.find((s) => s.id === selected.id) : undefined;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 px-8 pb-4 pt-7">
        <h1 className="text-[20px] font-bold text-white">Calendar</h1>
        <span className="text-[13px] text-white/40">{activeProject}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="flex h-7 w-7 items-center justify-center rounded text-white/50 hover:bg-white/5 hover:text-white"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => setMonth(startOfMonth(new Date()))}
            className="rounded px-2 py-1 text-[12px] text-white/50 hover:bg-white/5 hover:text-white"
          >
            Today
          </button>
          <button
            onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="flex h-7 w-7 items-center justify-center rounded text-white/50 hover:bg-white/5 hover:text-white"
          >
            <ChevronRight size={15} />
          </button>
        </div>
        <MonthYearPicker value={month} onChange={setMonth} />
      </div>

      <div className="clide-scroll flex-1 overflow-y-auto px-8 pb-8">
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-clide-border bg-clide-border">
          {DAY_NAMES.map((d) => (
            <div key={d} className="bg-clide-panel px-2 py-1.5 text-center text-[11px] font-medium text-white/40">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const inMonth = day.getMonth() === month.getMonth();
            const chips = chipsByDay.get(isoDate(day)) ?? [];
            const visible = chips.slice(0, MAX_CHIPS_PER_DAY);
            const overflow = chips.length - visible.length;
            return (
              <div
                key={day.toISOString()}
                onClick={() => openComposer(day)}
                className={`group flex min-h-[92px] cursor-pointer flex-col gap-1 bg-clide-bg p-1.5 hover:bg-white/[0.02] ${inMonth ? "" : "opacity-40"}`}
              >
                <span className="flex items-center justify-between">
                  <span
                    className={`text-[11px] ${isSameDay(day, new Date()) ? "font-bold text-white" : "text-white/40"}`}
                  >
                    {day.getDate()}
                  </span>
                  {/* Hover affordance (ticket 69): schedule a task or workflow for this day. */}
                  <span
                    title="Schedule a task or workflow for this day"
                    className="flex h-4 w-4 items-center justify-center rounded text-white/40 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Plus size={11} />
                  </span>
                </span>
                {visible.map((chip) => {
                  const name =
                    chip.kind === "task"
                      ? tasksBySlug.get(chip.item.taskSlug)?.meta.name ?? chip.item.taskSlug
                      : chip.item.workflowName;
                  const isSelected = selected?.kind === chip.kind && selected.id === chip.item.id;
                  return (
                    <button
                      key={chip.key}
                      disabled={chip.projected}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(chip);
                      }}
                      title={`${name} — ${chip.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                      className={`flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] ${
                        chip.projected
                          ? "border border-dashed border-white/10 text-white/30"
                          : chip.kind === "workflow"
                            ? `text-orange-200/90 hover:bg-orange-400/20 ${isSelected ? "bg-orange-400/25" : "bg-orange-400/10"}`
                            : `text-white/80 hover:bg-white/10 ${isSelected ? "bg-white/15" : "bg-white/5"}`
                      }`}
                    >
                      {chip.kind === "workflow" && <WorkflowIcon size={10} className="shrink-0" />}
                      <span className="truncate">
                        {chip.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {name}
                      </span>
                    </button>
                  );
                })}
                {overflow > 0 && <span className="text-[10px] text-white/30">+{overflow} more</span>}
              </div>
            );
          })}
        </div>

        {composeDate && <CalendarComposer date={composeDate} onClose={() => setComposeDate(null)} />}

        {selectedTask && (
          <ScheduleDetail
            label={tasksBySlug.get(selectedTask.taskSlug)?.meta.name ?? selectedTask.taskSlug}
            scheduledAt={selectedTask.scheduledAt ?? new Date().toISOString()}
            repeatInterval={selectedTask.repeatInterval ?? "none"}
            onClose={() => setSelected(null)}
            onSave={async (scheduledAt, repeat) => {
              await updateScheduledRun(selectedTask.id, scheduledAt, repeat);
              toast("Schedule updated");
              setSelected(null);
            }}
            onRunNow={async () => {
              await runScheduledNow(selectedTask.id);
              toast("Run started");
              setSelected(null);
            }}
            onCancel={async () => {
              const name = tasksBySlug.get(selectedTask.taskSlug)?.meta.name ?? selectedTask.taskSlug;
              const res = await confirm({
                title: "Cancel this scheduled run?",
                message: `"${name}" will no longer run${selectedTask.repeatInterval && selectedTask.repeatInterval !== "none" ? ", including future repeats" : ""}.`,
                confirmLabel: "Cancel run",
                cancelLabel: "Keep it",
              });
              if (!res.ok) return;
              await deleteRun(selectedTask.id);
              toast("Schedule cancelled");
              setSelected(null);
            }}
          />
        )}

        {selectedWorkflow && (
          <ScheduleDetail
            label={selectedWorkflow.workflowName}
            scheduledAt={selectedWorkflow.scheduledAt}
            repeatInterval={selectedWorkflow.repeatInterval}
            onClose={() => setSelected(null)}
            onSave={async (scheduledAt, repeat) => {
              await rescheduleWorkflowRun(selectedWorkflow.id, scheduledAt, repeat);
              toast("Schedule updated");
              setSelected(null);
            }}
            onRunNow={async () => {
              await runScheduledWorkflowRunNow(selectedWorkflow.id);
              toast("Workflow run started");
              setSelected(null);
            }}
            onCancel={async () => {
              const res = await confirm({
                title: "Cancel this scheduled run?",
                message: `"${selectedWorkflow.workflowName}" will no longer run${selectedWorkflow.repeatInterval !== "none" ? ", including future repeats" : ""}.`,
                confirmLabel: "Cancel run",
                cancelLabel: "Keep it",
              });
              if (!res.ok) return;
              await cancelScheduledWorkflowRun(selectedWorkflow.id);
              toast("Schedule cancelled");
              setSelected(null);
            }}
          />
        )}

        {scheduledTasks.length === 0 && scheduledWorkflows.length === 0 && !composeDate && (
          <div className="mt-6 text-center text-[13px] text-white/30">
            Nothing scheduled. Click a day to schedule a task or workflow, or use a task's ⋯ menu.
          </div>
        )}
      </div>
    </div>
  );
}

interface ScheduleDetailProps {
  label: string;
  scheduledAt: string;
  repeatInterval: RepeatInterval;
  onClose: () => void;
  onSave: (scheduledAt: string, repeat: RepeatInterval) => Promise<void>;
  onRunNow: () => Promise<void>;
  onCancel: () => Promise<void>;
}

function ScheduleDetail({ label, scheduledAt, repeatInterval, onClose, onSave, onRunNow, onCancel }: ScheduleDetailProps) {
  const scheduledDate = new Date(scheduledAt);
  const [date, setDate] = useState(isoDate(scheduledDate));
  const [time, setTime] = useState(
    `${String(scheduledDate.getHours()).padStart(2, "0")}:${String(scheduledDate.getMinutes()).padStart(2, "0")}`,
  );
  const [repeat, setRepeat] = useState<RepeatInterval>(repeatInterval);
  const [saving, setSaving] = useState(false);

  const inputClass =
    "rounded border border-clide-border bg-clide-surface text-white text-[13px] px-2 py-1 outline-none focus:border-white/30";

  const save = async () => {
    setSaving(true);
    const [h, m] = time.split(":").map(Number);
    const d = new Date(`${date}T00:00:00`);
    d.setHours(h ?? 0, m ?? 0, 0, 0);
    await onSave(d.toISOString(), repeat);
    setSaving(false);
  };

  return (
    // Modal over the body pane (tickets 74/75) — matches the composer's presentation.
    <Modal
      onClose={onClose}
      widthClassName="w-[520px]"
      panelClassName="clide-scroll flex max-h-[85%] flex-col gap-3 overflow-y-auto p-5"
    >
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-bold text-white">{label}</span>
        <button onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white">
          <X size={14} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[13px] text-white/70">
          Date
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-white/70">
          Time
          <input type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-white/70">
          Repeat
          <select className={inputClass} value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatInterval)}>
            <option value="none" className="bg-clide-panel">None</option>
            <option value="daily" className="bg-clide-panel">Daily</option>
            <option value="weekly" className="bg-clide-panel">Weekly</option>
          </select>
        </label>
        <button
          disabled={saving}
          onClick={() => void save()}
          className="rounded-md bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="flex items-center gap-2 border-t border-white/5 pt-3">
        <button
          onClick={() => void onRunNow()}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium text-white/70 hover:bg-white/5 hover:text-white"
        >
          <Play size={13} /> Run now
        </button>
        <button
          onClick={() => void onCancel()}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 size={13} /> Cancel
        </button>
      </div>
    </Modal>
  );
}
