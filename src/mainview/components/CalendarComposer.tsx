import { AlarmClock, Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { useTaskSearch } from "../hooks/useTaskSearch";
import { api } from "../rpc";
import type { RepeatInterval, TaskFolder } from "../types/tasks";
import Modal from "./Modal";
import TaskCardBody from "./TaskCardBody";
import { useUIFeedback } from "./UIFeedback";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isFilled(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
}

/** Default time for the clicked day: 09:00, or the next full hour when 09:00 today has already passed. */
function defaultTime(day: Date): string {
  const now = new Date();
  const nineAm = new Date(day);
  nineAm.setHours(9, 0, 0, 0);
  if (nineAm > now) return "09:00";
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  // Only same-day defaults roll forward; past days keep 09:00 (blocked anyway).
  if (isoDate(next) !== isoDate(day)) return "09:00";
  return `${String(next.getHours()).padStart(2, "0")}:00`;
}

interface CalendarComposerProps {
  /** The day the user clicked — the point of the whole flow. */
  date: Date;
  onClose: () => void;
}

/**
 * Schedule a form directly from a calendar day (tickets 69/74): pick a form,
 * fill its real fields (magic fields auto-fill, same path as the card), set
 * time/repeat, done — the date is prefilled from the clicked cell. Renders
 * as a modal over the body pane so long forms scroll inside it instead of
 * running off the bottom of the page.
 */
export default function CalendarComposer({ date, onClose }: CalendarComposerProps) {
  const { forms, activeProject, recentSlugs, scheduleRun, openNewForm } = useApp();
  const { toast } = useUIFeedback();
  const scopedForms = activeProject ? forms.filter((f) => f.meta.project === activeProject) : forms;

  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<TaskFolder | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [filling, setFilling] = useState<Set<string>>(new Set());
  const [fillFailed, setFillFailed] = useState(false);
  const touchedRef = useRef<Set<string>>(new Set());

  const [dateStr, setDateStr] = useState(isoDate(date));
  const [time, setTime] = useState(() => defaultTime(date));
  const [repeat, setRepeat] = useState<RepeatInterval>("none");
  const [saving, setSaving] = useState(false);

  const results = useTaskSearch(scopedForms, query, recentSlugs);

  const pick = (folder: TaskFolder) => {
    // Switching forms resets everything — stale values must not leak (ticket 69).
    setPicked(folder);
    setValues({});
    setFillFailed(false);
    touchedRef.current = new Set();

    const magicFields: Record<string, string> = {};
    for (const f of folder.task.fields) {
      if (f.magic?.prompt) magicFields[f.id] = f.magic.prompt;
    }
    const ids = Object.keys(magicFields);
    if (ids.length === 0) return;
    setFilling(new Set(ids));
    void api.fillMagicFields(folder.meta.slug, magicFields).then((result) => {
      setFilling(new Set());
      if (result.ok && result.values) {
        setValues((prev) => {
          const next = { ...prev };
          for (const [id, value] of Object.entries(result.values!)) {
            // Never overwrite values the user typed while the fill was pending.
            if (!touchedRef.current.has(id)) next[id] = value;
          }
          return next;
        });
      } else {
        setFillFailed(true);
      }
    });
  };

  const setValue = (id: string, value: unknown) => {
    touchedRef.current.add(id);
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  const scheduledDate = useMemo(() => {
    const [h, m] = time.split(":").map(Number);
    const d = new Date(`${dateStr}T00:00:00`);
    d.setHours(h ?? 0, m ?? 0, 0, 0);
    return d;
  }, [dateStr, time]);

  const inPast = scheduledDate.getTime() <= Date.now();
  const requiredFilled = picked ? picked.task.fields.every((f) => !f.required || isFilled(values[f.id])) : false;
  const canSchedule = picked !== null && requiredFilled && !inPast && !saving;

  const schedule = async () => {
    if (!picked) return;
    setSaving(true);
    await scheduleRun(picked.meta.slug, values, scheduledDate.toISOString(), repeat);
    setSaving(false);
    toast(
      `Scheduled "${picked.meta.name}" for ${scheduledDate.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
    );
    onClose();
  };

  const inputClass =
    "rounded border border-clide-border bg-clide-surface text-white text-[13px] px-2 py-1 outline-none focus:border-white/30";

  return (
    <Modal
      onClose={onClose}
      widthClassName="w-[560px]"
      backdropClassName="pt-10"
      panelClassName="flex max-h-[85%] flex-col overflow-hidden"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-clide-border px-5 py-4">
        <span className="flex items-center gap-2 text-[14px] font-bold text-white">
          <AlarmClock size={15} className="text-orange-400" />
          Schedule for {date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </span>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"
        >
          <X size={14} />
        </button>
      </div>

      <div className="clide-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {scopedForms.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="text-[13px] text-white/50">This project has no tasks yet.</span>
            <button
              onClick={() => {
                onClose();
                openNewForm();
              }}
              className="rounded-md bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/20"
            >
              Create one
            </button>
          </div>
        ) : (
          <>
            {/* Task picker */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 rounded-md border border-clide-border bg-clide-surface px-2.5 py-1.5">
                <Search size={13} className="shrink-0 text-white/30" />
                <input
                  autoFocus={picked === null}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={picked ? picked.meta.name : "Pick a task to schedule…"}
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/40"
                />
              </div>
              {(picked === null || query.trim() !== "") && (
                <div className="clide-scroll flex max-h-40 flex-col gap-0.5 overflow-y-auto">
                  {results.length === 0 && (
                    <div className="px-2 py-1.5 text-[12px] italic text-white/30">No tasks match.</div>
                  )}
                  {results.map((folder) => (
                    <button
                      key={folder.meta.slug}
                      onClick={() => {
                        pick(folder);
                        setQuery("");
                      }}
                      className={`flex items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-[13px] ${
                        picked?.meta.slug === folder.meta.slug
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span className="min-w-0 truncate">{folder.meta.name}</span>
                      {folder.meta.description && (
                        <span className="min-w-0 shrink truncate text-[12px] text-white/40">
                          {folder.meta.description}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* The picked form's real fields — same rendering as the card. */}
            {picked && (
              <div className="rounded-md border border-clide-border bg-clide-surface">
                <TaskCardBody
                  form={picked.task}
                  values={values}
                  onChange={setValue}
                  filling={filling}
                  fillFailed={fillFailed}
                />
              </div>
            )}

            {/* When */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-[13px] text-white/70">
                Date
                <input
                  type="date"
                  className={inputClass}
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-[13px] text-white/70">
                Time
                <input type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-[13px] text-white/70">
                Repeat
                <select
                  className={inputClass}
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value as RepeatInterval)}
                >
                  <option value="none" className="bg-clide-panel">
                    None
                  </option>
                  <option value="daily" className="bg-clide-panel">
                    Daily
                  </option>
                  <option value="weekly" className="bg-clide-panel">
                    Weekly
                  </option>
                </select>
              </label>
              <div className="flex-1" />
              {inPast && (
                <span className="text-[12px] text-amber-300/80">That's in the past — pick a future time.</span>
              )}
              <button
                disabled={!canSchedule}
                onClick={() => void schedule()}
                className="rounded-md bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
              >
                {saving ? "Scheduling…" : "Schedule"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
