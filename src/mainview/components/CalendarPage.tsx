import { ChevronLeft, ChevronRight, Play, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import CalendarComposer from "./CalendarComposer";
import Modal from "./Modal";
import MonthYearPicker from "./MonthYearPicker";
import { useUIFeedback } from "./UIFeedback";
import type { RepeatInterval, RunRecord } from "../types/forms";

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

interface Chip {
  key: string;
  date: Date;
  run: RunRecord;
  /** A computed future occurrence of a recurring run, not a persisted row — not editable. */
  projected: boolean;
}

/** Computes visual-only future occurrences of a recurring scheduled run within a date range. */
function projectOccurrences(run: RunRecord, rangeStart: Date, rangeEnd: Date): Date[] {
  if (!run.scheduledAt || !run.repeatInterval || run.repeatInterval === "none") return [];
  const stepDays = run.repeatInterval === "daily" ? 1 : 7;
  let current = addDays(new Date(run.scheduledAt), stepDays);
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
  const { activeProject, runs, formsBySlug, updateScheduledRun, runScheduledNow, deleteRun } = useApp();
  const { confirm, toast } = useUIFeedback();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Day being composed for (ticket 69). Composer and ScheduleDetail are mutually exclusive. */
  const [composeDate, setComposeDate] = useState<Date | null>(null);

  const openComposer = (day: Date) => {
    setSelectedId(null);
    setComposeDate(day);
  };

  const openDetail = (runId: string) => {
    setComposeDate(null);
    setSelectedId(runId);
  };

  const scheduled = useMemo(
    () => runs.filter((r) => r.status === "scheduled" && formsBySlug.get(r.formSlug)?.meta.project === activeProject),
    [runs, formsBySlug, activeProject],
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
    for (const run of scheduled) {
      if (!run.scheduledAt) continue;
      push({ key: `${run.id}-real`, date: new Date(run.scheduledAt), run, projected: false });
      for (const occ of projectOccurrences(run, gridStart, rangeEnd)) {
        push({ key: `${run.id}-${occ.getTime()}`, date: occ, run, projected: true });
      }
    }
    return map;
  }, [scheduled, gridStart, rangeEnd]);

  const selected = selectedId ? scheduled.find((r) => r.id === selectedId) : undefined;

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
                  {/* Hover affordance (ticket 69): schedule a form for this day. */}
                  <span
                    title="Schedule a form for this day"
                    className="flex h-4 w-4 items-center justify-center rounded text-white/40 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Plus size={11} />
                  </span>
                </span>
                {visible.map((chip) => (
                  <button
                    key={chip.key}
                    disabled={chip.projected}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetail(chip.run.id);
                    }}
                    title={`${formsBySlug.get(chip.run.formSlug)?.meta.name ?? chip.run.formSlug} — ${chip.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                    className={`truncate rounded px-1.5 py-0.5 text-left text-[11px] ${
                      chip.projected
                        ? "border border-dashed border-white/10 text-white/30"
                        : `text-white/80 hover:bg-white/10 ${selectedId === chip.run.id ? "bg-white/15" : "bg-white/5"}`
                    }`}
                  >
                    {chip.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{" "}
                    {formsBySlug.get(chip.run.formSlug)?.meta.name ?? chip.run.formSlug}
                  </button>
                ))}
                {overflow > 0 && <span className="text-[10px] text-white/30">+{overflow} more</span>}
              </div>
            );
          })}
        </div>

        {composeDate && <CalendarComposer date={composeDate} onClose={() => setComposeDate(null)} />}

        {selected && (
          <ScheduleDetail
            run={selected}
            formName={formsBySlug.get(selected.formSlug)?.meta.name ?? selected.formSlug}
            onClose={() => setSelectedId(null)}
            onSave={async (scheduledAt, repeat) => {
              await updateScheduledRun(selected.id, scheduledAt, repeat);
              toast("Schedule updated");
              setSelectedId(null);
            }}
            onRunNow={async () => {
              await runScheduledNow(selected.id);
              toast("Run started");
              setSelectedId(null);
            }}
            onCancel={async () => {
              const name = formsBySlug.get(selected.formSlug)?.meta.name ?? selected.formSlug;
              const res = await confirm({
                title: "Cancel this scheduled run?",
                message: `"${name}" will no longer run${selected.repeatInterval && selected.repeatInterval !== "none" ? ", including future repeats" : ""}.`,
                confirmLabel: "Cancel run",
                cancelLabel: "Keep it",
              });
              if (!res.ok) return;
              await deleteRun(selected.id);
              toast("Schedule cancelled");
              setSelectedId(null);
            }}
          />
        )}

        {scheduled.length === 0 && !composeDate && (
          <div className="mt-6 text-center text-[13px] text-white/30">
            Nothing scheduled. Click a day to schedule a form, or use a form's ⋯ menu.
          </div>
        )}
      </div>
    </div>
  );
}

interface ScheduleDetailProps {
  run: RunRecord;
  formName: string;
  onClose: () => void;
  onSave: (scheduledAt: string, repeat: RepeatInterval) => Promise<void>;
  onRunNow: () => Promise<void>;
  onCancel: () => Promise<void>;
}

function ScheduleDetail({ run, formName, onClose, onSave, onRunNow, onCancel }: ScheduleDetailProps) {
  const scheduledDate = run.scheduledAt ? new Date(run.scheduledAt) : new Date();
  const [date, setDate] = useState(isoDate(scheduledDate));
  const [time, setTime] = useState(
    `${String(scheduledDate.getHours()).padStart(2, "0")}:${String(scheduledDate.getMinutes()).padStart(2, "0")}`,
  );
  const [repeat, setRepeat] = useState<RepeatInterval>(run.repeatInterval ?? "none");
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
        <span className="text-[14px] font-bold text-white">{formName}</span>
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
