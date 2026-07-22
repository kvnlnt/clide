import { ChevronLeft, ChevronRight, Play, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import CalendarComposer from "./CalendarComposer";
import Modal from "./Modal";
import MonthYearPicker from "./MonthYearPicker";
import { useUIFeedback } from "./UIFeedback";
import AgendaView from "./calendar/AgendaView";
import DayView from "./calendar/DayView";
import MonthView from "./calendar/MonthView";
import WeekView from "./calendar/WeekView";
import {
  addDays,
  buildAgendaChips,
  buildChipsByDay,
  endOfDay,
  startOfDay,
  startOfGrid,
  startOfMonth,
  startOfWeek,
} from "./calendar/calendarUtils";
import type { Chip, ChipFilter, Selected } from "./calendar/calendarUtils";
import type { CalendarViewMode, RepeatInterval } from "../types/tasks";

/** How far forward the Agenda view looks (ticket 128) — enough to surface weekly-recurring items several cycles out. */
const AGENDA_WINDOW_DAYS = 90;

const VIEWS: { id: CalendarViewMode; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "agenda", label: "Agenda" },
];

export default function CalendarPage() {
  const {
    activeProject,
    runs,
    tasksBySlug,
    updateScheduledRun,
    runScheduledNow,
    deleteRun,
    deleteOccurrence,
    scheduledWorkflows,
    rescheduleWorkflowRun,
    runScheduledWorkflowRunNow,
    cancelScheduledWorkflowRun,
    deleteScheduledWorkflowOccurrence,
    calendarView: view,
    setCalendarView: setView,
  } = useApp();
  const { confirm, toast } = useUIFeedback();

  /** Where the current view is positioned — reset to "now" on mount, like the old month-only state. */
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [filter, setFilter] = useState<ChipFilter>({ tasks: true, workflows: true });
  const [selected, setSelected] = useState<Selected>(null);
  /** Day (optionally with an hour, from a Day/Week slot click) being composed for (ticket 69/128). */
  const [composeDate, setComposeDate] = useState<Date | null>(null);

  const openComposer = (day: Date) => {
    setSelected(null);
    setComposeDate(day);
  };

  const openDetail = (chip: Chip) => {
    setComposeDate(null);
    setSelected(
      chip.kind === "task"
        ? { kind: "task", id: chip.item.id, occurrenceAt: chip.date.toISOString() }
        : { kind: "workflow", id: chip.item.id, occurrenceAt: chip.date.toISOString() },
    );
  };

  const scheduledTasks = useMemo(
    () => runs.filter((r) => r.status === "scheduled" && tasksBySlug.get(r.taskSlug)?.meta.project === activeProject),
    [runs, tasksBySlug, activeProject],
  );

  const anchorMonth = useMemo(() => startOfMonth(anchorDate), [anchorDate]);
  const anchorWeekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate]);
  const anchorDay = useMemo(() => startOfDay(anchorDate), [anchorDate]);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === "month") {
      const gridStart = startOfGrid(anchorMonth);
      return { rangeStart: gridStart, rangeEnd: endOfDay(addDays(gridStart, 41)) };
    }
    if (view === "week") {
      return { rangeStart: anchorWeekStart, rangeEnd: endOfDay(addDays(anchorWeekStart, 6)) };
    }
    if (view === "day") {
      return { rangeStart: anchorDay, rangeEnd: endOfDay(anchorDay) };
    }
    const today = startOfDay(new Date());
    return { rangeStart: today, rangeEnd: endOfDay(addDays(today, AGENDA_WINDOW_DAYS)) };
  }, [view, anchorMonth, anchorWeekStart, anchorDay]);

  const chipsByDay = useMemo(
    () => buildChipsByDay(scheduledTasks, scheduledWorkflows, rangeStart, rangeEnd, filter),
    [scheduledTasks, scheduledWorkflows, rangeStart, rangeEnd, filter],
  );
  const agendaChips = useMemo(
    () => (view === "agenda" ? buildAgendaChips(scheduledTasks, scheduledWorkflows, rangeStart, rangeEnd, filter) : []),
    [view, scheduledTasks, scheduledWorkflows, rangeStart, rangeEnd, filter],
  );

  const periodLabel = useMemo(() => {
    if (view === "month") return anchorMonth.toLocaleDateString([], { month: "long", year: "numeric" });
    if (view === "week") {
      const end = addDays(anchorWeekStart, 6);
      const sameMonth = anchorWeekStart.getMonth() === end.getMonth();
      const startStr = anchorWeekStart.toLocaleDateString([], { month: "short", day: "numeric" });
      const endStr = end.toLocaleDateString(
        [],
        sameMonth ? { day: "numeric", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" },
      );
      return `${startStr} – ${endStr}`;
    }
    if (view === "day") {
      return anchorDay.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    }
    return `Next ${AGENDA_WINDOW_DAYS} days`;
  }, [view, anchorMonth, anchorWeekStart, anchorDay]);

  const page = useCallback(
    (dir: number) => {
      if (view === "month") setAnchorDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
      else if (view === "week") setAnchorDate((d) => addDays(d, dir * 7));
      else if (view === "day") setAnchorDate((d) => addDays(d, dir));
    },
    [view],
  );
  const goToday = () => setAnchorDate(new Date());

  // Keyboard paging between periods (ticket 128) — inert while a modal is open
  // (the same overlay-guard convention App.tsx uses for its shortcuts), while
  // typing into a field, or in Agenda (which has no discrete "period").
  useEffect(() => {
    if (view === "agenda") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (composeDate || selected) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.key === "ArrowLeft" || e.key === "[") {
        e.preventDefault();
        page(-1);
      } else if (e.key === "ArrowRight" || e.key === "]") {
        e.preventDefault();
        page(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, composeDate, selected, page]);

  const rescheduleChip = useCallback(
    async (chip: Chip, slot: Date) => {
      if (chip.projected) return;
      if (slot.getTime() <= Date.now()) {
        toast("That's in the past — pick a future time.", "error");
        return;
      }
      if (chip.kind === "task") {
        await updateScheduledRun(chip.item.id, slot.toISOString(), chip.item.repeatInterval ?? "none");
      } else {
        await rescheduleWorkflowRun(chip.item.id, slot.toISOString(), chip.item.repeatInterval);
      }
      const when = slot.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      toast(`Rescheduled to ${when}`);
    },
    [toast, updateScheduledRun, rescheduleWorkflowRun],
  );

  /** Month's drop target is a whole day cell — keep the chip's original time-of-day. */
  const handleDropOnDay = useCallback(
    (chip: Chip, day: Date) => {
      const slot = new Date(day);
      slot.setHours(chip.date.getHours(), chip.date.getMinutes(), 0, 0);
      void rescheduleChip(chip, slot);
    },
    [rescheduleChip],
  );

  const selectedTask = selected?.kind === "task" ? scheduledTasks.find((r) => r.id === selected.id) : undefined;
  const selectedWorkflow =
    selected?.kind === "workflow" ? scheduledWorkflows.find((s) => s.id === selected.id) : undefined;

  const composeInitialTime = useMemo(() => {
    if (!composeDate) return undefined;
    if (composeDate.getHours() === 0 && composeDate.getMinutes() === 0) return undefined;
    return `${String(composeDate.getHours()).padStart(2, "0")}:${String(composeDate.getMinutes()).padStart(2, "0")}`;
  }, [composeDate]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-[var(--clide-page-x)] pb-4 pt-[var(--clide-page-top)]">
        <h1 className="text-[20px] font-bold text-white">Calendar</h1>
        <span className="text-[13px] text-white/40">{activeProject}</span>

        <div className="flex items-center gap-1 rounded-md border border-clide-border bg-clide-surface px-2 py-1 text-[11px]">
          <FilterToggle active={filter.tasks} swatch="bg-white/50" label="Tasks" onClick={() => setFilter((f) => ({ ...f, tasks: !f.tasks }))} />
          <FilterToggle
            active={filter.workflows}
            swatch="bg-orange-400"
            label="Workflows"
            onClick={() => setFilter((f) => ({ ...f, workflows: !f.workflows }))}
          />
        </div>

        <div className="flex-1" />

        <div className="flex items-center rounded-md border border-clide-border bg-clide-surface p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`rounded px-2.5 py-1 text-[12px] font-medium ${
                view === v.id ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {view !== "agenda" && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => page(-1)}
              className="flex h-7 w-7 items-center justify-center rounded text-white/50 hover:bg-white/5 hover:text-white"
            >
              <ChevronLeft size={15} />
            </button>
            <button onClick={goToday} className="rounded px-2 py-1 text-[12px] text-white/50 hover:bg-white/5 hover:text-white">
              Today
            </button>
            <button
              onClick={() => page(1)}
              className="flex h-7 w-7 items-center justify-center rounded text-white/50 hover:bg-white/5 hover:text-white"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
        {view === "agenda" && (
          <button onClick={goToday} className="rounded px-2 py-1 text-[12px] text-white/50 hover:bg-white/5 hover:text-white">
            Today
          </button>
        )}

        {view === "month" ? (
          <MonthYearPicker value={anchorMonth} onChange={setAnchorDate} />
        ) : (
          <span className="text-[13px] font-medium text-white/70">{periodLabel}</span>
        )}
      </div>

      <div className="clide-scroll flex-1 overflow-y-auto px-[var(--clide-page-x)] pb-[var(--clide-page-bottom)]">
        {view === "month" && (
          <MonthView
            month={anchorMonth}
            chipsByDay={chipsByDay}
            tasksBySlug={tasksBySlug}
            selected={selected}
            onSelectChip={openDetail}
            onDayClick={openComposer}
            onOverflowClick={(day) => {
              setAnchorDate(day);
              setView("day");
            }}
            onDropChip={handleDropOnDay}
          />
        )}
        {view === "week" && (
          <WeekView
            anchor={anchorWeekStart}
            chipsByDay={chipsByDay}
            tasksBySlug={tasksBySlug}
            selected={selected}
            onSelectChip={openDetail}
            onSlotClick={openComposer}
            onDropChip={(chip, slot) => void rescheduleChip(chip, slot)}
          />
        )}
        {view === "day" && (
          <DayView
            day={anchorDay}
            chipsByDay={chipsByDay}
            tasksBySlug={tasksBySlug}
            selected={selected}
            onSelectChip={openDetail}
            onSlotClick={openComposer}
            onDropChip={(chip, slot) => void rescheduleChip(chip, slot)}
          />
        )}
        {view === "agenda" && (
          <AgendaView
            chips={agendaChips}
            tasksBySlug={tasksBySlug}
            selected={selected}
            onSelectChip={openDetail}
            onScheduleForDate={openComposer}
          />
        )}

        {composeDate && (
          <CalendarComposer date={composeDate} initialTime={composeInitialTime} onClose={() => setComposeDate(null)} />
        )}

        {selectedTask && selected?.kind === "task" && (
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
            onCancel={async (scope) => {
              const name = tasksBySlug.get(selectedTask.taskSlug)?.meta.name ?? selectedTask.taskSlug;
              const recurring = !!selectedTask.repeatInterval && selectedTask.repeatInterval !== "none";
              const res = await confirm({
                title: !recurring ? "Cancel this scheduled run?" : scope === "series" ? "Delete the entire series?" : "Delete this occurrence?",
                message:
                  scope === "series"
                    ? `"${name}" will no longer run${recurring ? ", including future repeats" : ""}.`
                    : `Only this occurrence of "${name}" is removed — the rest of the series stays scheduled.`,
                confirmLabel: !recurring ? "Cancel run" : scope === "series" ? "Delete series" : "Delete occurrence",
                cancelLabel: "Keep it",
              });
              if (!res.ok) return;
              if (scope === "series") await deleteRun(selectedTask.id);
              else await deleteOccurrence(selectedTask.id, selected.occurrenceAt);
              toast(scope === "series" ? "Schedule cancelled" : "Occurrence deleted");
              setSelected(null);
            }}
          />
        )}

        {selectedWorkflow && selected?.kind === "workflow" && (
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
            onCancel={async (scope) => {
              const recurring = selectedWorkflow.repeatInterval !== "none";
              const res = await confirm({
                title: !recurring ? "Cancel this scheduled run?" : scope === "series" ? "Delete the entire series?" : "Delete this occurrence?",
                message:
                  scope === "series"
                    ? `"${selectedWorkflow.workflowName}" will no longer run${recurring ? ", including future repeats" : ""}.`
                    : `Only this occurrence of "${selectedWorkflow.workflowName}" is removed — the rest of the series stays scheduled.`,
                confirmLabel: !recurring ? "Cancel run" : scope === "series" ? "Delete series" : "Delete occurrence",
                cancelLabel: "Keep it",
              });
              if (!res.ok) return;
              if (scope === "series") await cancelScheduledWorkflowRun(selectedWorkflow.id);
              else await deleteScheduledWorkflowOccurrence(selectedWorkflow.id, selected.occurrenceAt);
              toast(scope === "series" ? "Schedule cancelled" : "Occurrence deleted");
              setSelected(null);
            }}
          />
        )}

        {view !== "agenda" && scheduledTasks.length === 0 && scheduledWorkflows.length === 0 && !composeDate && (
          <div className="mt-6 text-center text-[13px] text-white/30">
            Nothing scheduled. Click a day to schedule a task or workflow, or use a task's ⋯ menu.
          </div>
        )}
      </div>
    </div>
  );
}

function FilterToggle({ active, swatch, label, onClick }: { active: boolean; swatch: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 ${active ? "text-white/80" : "text-white/30"}`}
    >
      <span className={`h-2 w-2 rounded-full ${active ? swatch : "bg-white/15"}`} />
      {label}
    </button>
  );
}

/** "occurrence" drops just the instance being viewed; "series" ends the whole recurrence (ticket 129). */
type CancelScope = "occurrence" | "series";

interface ScheduleDetailProps {
  label: string;
  scheduledAt: string;
  repeatInterval: RepeatInterval;
  onClose: () => void;
  onSave: (scheduledAt: string, repeat: RepeatInterval) => Promise<void>;
  onRunNow: () => Promise<void>;
  onCancel: (scope: CancelScope) => Promise<void>;
}

function ScheduleDetail({ label, scheduledAt, repeatInterval, onClose, onSave, onRunNow, onCancel }: ScheduleDetailProps) {
  const scheduledDate = new Date(scheduledAt);
  const [date, setDate] = useState(
    `${scheduledDate.getFullYear()}-${String(scheduledDate.getMonth() + 1).padStart(2, "0")}-${String(scheduledDate.getDate()).padStart(2, "0")}`,
  );
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
        {repeatInterval !== "none" ? (
          <>
            <button
              onClick={() => void onCancel("occurrence")}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 size={13} /> Delete this occurrence
            </button>
            <button
              onClick={() => void onCancel("series")}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 size={13} /> Delete the series
            </button>
          </>
        ) : (
          <button
            onClick={() => void onCancel("series")}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 size={13} /> Cancel
          </button>
        )}
      </div>
    </Modal>
  );
}
