import { AlarmClock, FileText, Search, Workflow as WorkflowIcon, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { useTaskSearch } from "../hooks/useTaskSearch";
import { api } from "../rpc";
import type { RepeatInterval, TaskFolder, Workflow } from "../types/tasks";
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

type Picked = { kind: "task"; folder: TaskFolder } | { kind: "workflow"; workflow: Workflow };

interface CalendarComposerProps {
  /** The day the user clicked — the point of the whole flow. */
  date: Date;
  /** Exact "HH:MM" to prefill, e.g. from an hour-slot click in Day/Week view — overrides the default-time heuristic. */
  initialTime?: string;
  onClose: () => void;
}

/**
 * Schedule a task or a workflow directly from a calendar day (tickets
 * 69/74/117): pick either from one combined search (same spirit as the ⌘K
 * picker, ticket 93), fill its real fields/params, set time/repeat, done —
 * the date is prefilled from the clicked cell. Renders as a modal over the
 * body pane so long forms scroll inside it instead of running off the
 * bottom of the page.
 */
export default function CalendarComposer({ date, initialTime, onClose }: CalendarComposerProps) {
  const { tasks, workflows, activeProject, recentSlugs, scheduleRun, scheduleWorkflowRun, openNewTask } = useApp();
  const { toast } = useUIFeedback();
  const scopedTasks = activeProject ? tasks.filter((f) => f.meta.project === activeProject) : tasks;

  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [workflowParams, setWorkflowParams] = useState<Record<string, string>>({});
  const [filling, setFilling] = useState<Set<string>>(new Set());
  const [fillFailed, setFillFailed] = useState(false);
  const touchedRef = useRef<Set<string>>(new Set());

  const [dateStr, setDateStr] = useState(isoDate(date));
  const [time, setTime] = useState(() => initialTime ?? defaultTime(date));
  const [repeat, setRepeat] = useState<RepeatInterval>("none");
  const [saving, setSaving] = useState(false);

  const taskResults = useTaskSearch(scopedTasks, query, recentSlugs);
  const workflowResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return workflows.filter(
      (w) => q === "" || w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q),
    );
  }, [workflows, query]);
  const hasAnyTargets = scopedTasks.length > 0 || workflows.length > 0;

  const pickTask = (folder: TaskFolder) => {
    // Switching tasks resets everything — stale values must not leak (ticket 69).
    setPicked({ kind: "task", folder });
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

  const pickWorkflow = (workflow: Workflow) => {
    setPicked({ kind: "workflow", workflow });
    setWorkflowParams(Object.fromEntries((workflow.params ?? []).map((p) => [p, ""])));
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
  const requiredFilled =
    picked?.kind === "task" ? picked.folder.task.fields.every((f) => !f.required || isFilled(values[f.id])) : true;
  const canSchedule = picked !== null && requiredFilled && !inPast && !saving;

  const schedule = async () => {
    if (!picked) return;
    setSaving(true);
    const when = scheduledDate.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    if (picked.kind === "task") {
      await scheduleRun(picked.folder.meta.slug, values, scheduledDate.toISOString(), repeat);
      toast(`Scheduled "${picked.folder.meta.name}" for ${when}`);
    } else {
      const res = await scheduleWorkflowRun(
        picked.workflow.id,
        picked.workflow.name,
        workflowParams,
        scheduledDate.toISOString(),
        repeat,
      );
      if (res.ok) toast(`Scheduled "${picked.workflow.name}" for ${when}`);
      else toast(res.error ?? "Couldn't schedule the workflow", "error");
    }
    setSaving(false);
    onClose();
  };

  const inputClass =
    "rounded border border-clide-border bg-clide-surface text-white text-[13px] px-2 py-1 outline-none focus:border-white/30";

  const showResults = picked === null || query.trim() !== "";

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
        {!hasAnyTargets ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="text-[13px] text-white/50">This project has no tasks or workflows yet.</span>
            <button
              onClick={() => {
                onClose();
                openNewTask();
              }}
              className="rounded-md bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/20"
            >
              Create a task
            </button>
          </div>
        ) : (
          <>
            {/* Task/workflow picker */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 rounded-md border border-clide-border bg-clide-surface px-2.5 py-1.5">
                <Search size={13} className="shrink-0 text-white/30" />
                <input
                  autoFocus={picked === null}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    picked
                      ? picked.kind === "task"
                        ? picked.folder.meta.name
                        : picked.workflow.name
                      : "Pick a task or workflow to schedule…"
                  }
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/40"
                />
              </div>
              {showResults && (
                <div className="clide-scroll flex max-h-40 flex-col gap-0.5 overflow-y-auto">
                  {taskResults.length === 0 && workflowResults.length === 0 && (
                    <div className="px-2 py-1.5 text-[12px] italic text-white/30">Nothing matches.</div>
                  )}
                  {taskResults.map((folder) => (
                    <button
                      key={folder.meta.slug}
                      onClick={() => {
                        pickTask(folder);
                        setQuery("");
                      }}
                      className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] ${
                        picked?.kind === "task" && picked.folder.meta.slug === folder.meta.slug
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <FileText size={13} className="shrink-0 text-white/40" />
                      <span className="min-w-0 truncate">{folder.meta.name}</span>
                      {folder.meta.description && (
                        <span className="min-w-0 shrink truncate text-[12px] text-white/40">
                          {folder.meta.description}
                        </span>
                      )}
                    </button>
                  ))}
                  {workflowResults.map((workflow) => (
                    <button
                      key={workflow.id}
                      onClick={() => {
                        pickWorkflow(workflow);
                        setQuery("");
                      }}
                      className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] ${
                        picked?.kind === "workflow" && picked.workflow.id === workflow.id
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <WorkflowIcon size={13} className="shrink-0 text-orange-300/70" />
                      <span className="min-w-0 truncate">{workflow.name}</span>
                      <span className="shrink-0 rounded-full bg-orange-400/10 px-1.5 py-0.5 text-[10px] uppercase text-orange-300/70">
                        workflow
                      </span>
                      {!workflow.enabled && <span className="shrink-0 text-[11px] text-white/30">disabled</span>}
                      {workflow.description && (
                        <span className="min-w-0 shrink truncate text-[12px] text-white/40">
                          {workflow.description}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* The picked task's real fields — same rendering as the card. */}
            {picked?.kind === "task" && (
              <div className="rounded-md border border-clide-border bg-clide-surface">
                <TaskCardBody
                  taskDef={picked.folder.task}
                  values={values}
                  onChange={setValue}
                  filling={filling}
                  fillFailed={fillFailed}
                />
              </div>
            )}

            {/* The picked workflow's manual-trigger params (ticket 90). */}
            {picked?.kind === "workflow" && (
              <div className="flex flex-col gap-2.5 rounded-md border border-clide-border bg-clide-surface p-3">
                {!picked.workflow.enabled && (
                  <span className="text-[12px] text-amber-300/80">
                    This workflow is disabled — enable it from the Workflows page before its schedule will fire.
                  </span>
                )}
                {(picked.workflow.params ?? []).length === 0 ? (
                  <span className="text-[13px] text-white/40">This workflow takes no parameters.</span>
                ) : (
                  (picked.workflow.params ?? []).map((p) => (
                    <label key={p} className="flex flex-col gap-1">
                      <span className="text-[12px] font-medium text-white/60">{p}</span>
                      <input
                        value={workflowParams[p] ?? ""}
                        onChange={(e) => setWorkflowParams((prev) => ({ ...prev, [p]: e.target.value }))}
                        className="w-full rounded-md border border-clide-border bg-clide-bg px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30"
                      />
                    </label>
                  ))
                )}
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
