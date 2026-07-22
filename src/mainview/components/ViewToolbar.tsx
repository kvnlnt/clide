import { EllipsisVertical, Play, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import type { FilterEntry, FilterEntryType, RunStatus, ThreadView } from "../types/tasks";
import PortalPopover from "./PortalPopover";
import { STATUS_META } from "./statusIcon";
import Toolbar from "./Toolbar";

const STATUS_OPTIONS: RunStatus[] = ["idle", "running", "success", "error", "scheduled"];

const TYPE_LABEL: Record<FilterEntryType, string> = { task: "Task", status: "Status", keyword: "Keyword" };

/** Either picking which filter type to add, or editing one entry's criteria (new or existing). */
type PopoverState = { mode: "pick-type" } | { mode: "criteria"; type: FilterEntryType; entryId: string };

interface Props {
  view: ThreadView;
}

/**
 * Toolbar for an active view tab: fused visually to the tab above it. Filters
 * are additive chips (ticket 51) — a "+" button adds a chip via a two-step
 * popover (pick type, then pick criteria); clicking a chip reopens the
 * criteria step to edit it live. View rename/hide/delete live in a modal
 * behind the kebab menu (ticket 50), not inline in this toolbar.
 */
export default function ViewToolbar({ view }: Props) {
  const { tasks, activeProject, updateView, openRunPicker, openViewSettings } = useApp();

  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [taskQuery, setTaskQuery] = useState("");
  const [keywordInput, setKeywordInput] = useState("");

  // Only resync local echo state when the active view itself changes.
  useEffect(() => {
    setPopover(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.id]);

  const projectTasks = tasks.filter((f) => f.meta.project === activeProject);
  const entries = view.filters.entries ?? [];

  const nameFor = (slug: string) => projectTasks.find((f) => f.meta.slug === slug)?.meta.name ?? slug;

  const currentEntry = popover?.mode === "criteria" ? entries.find((e) => e.id === popover.entryId) : undefined;
  const currentValues = currentEntry?.values ?? [];

  const taskSuggestions = useMemo(() => {
    const q = taskQuery.trim().toLowerCase();
    return projectTasks
      .filter(
        (f) =>
          !currentValues.includes(f.meta.slug) &&
          (q === "" || f.meta.name.toLowerCase().includes(q) || f.meta.slug.includes(q)),
      )
      .slice(0, 8);
  }, [projectTasks, currentValues, taskQuery]);

  const setEntries = (next: FilterEntry[]) => {
    const filters = { ...view.filters };
    if (next.length > 0) filters.entries = next;
    else delete filters.entries;
    updateView({ ...view, filters });
  };

  const removeEntry = (entryId: string) => setEntries(entries.filter((e) => e.id !== entryId));

  // Adds the entry on first value, updates it in place after, and removes it
  // if the caller empties it out — one path serves both "add" and "edit".
  const applyValues = (type: FilterEntryType, entryId: string, values: string[]) => {
    const exists = entries.some((e) => e.id === entryId);
    if (values.length === 0) {
      if (exists) setEntries(entries.filter((e) => e.id !== entryId));
      return;
    }
    if (exists) setEntries(entries.map((e) => (e.id === entryId ? { ...e, values } : e)));
    else setEntries([...entries, { id: entryId, type, values }]);
  };

  const openAddPopover = (e: React.MouseEvent<HTMLButtonElement>) => {
    anchorRef.current = e.currentTarget;
    setPopover({ mode: "pick-type" });
  };

  const openEditPopover = (e: React.MouseEvent<HTMLButtonElement>, entry: FilterEntry) => {
    anchorRef.current = e.currentTarget;
    setTaskQuery("");
    setKeywordInput("");
    setPopover({ mode: "criteria", type: entry.type, entryId: entry.id });
  };

  const pickType = (type: FilterEntryType) => {
    setTaskQuery("");
    setKeywordInput("");
    setPopover({ mode: "criteria", type, entryId: crypto.randomUUID() });
  };

  const chipLabel = (entry: FilterEntry): string => {
    if (entry.type === "task") {
      return entry.values.length === 1 ? nameFor(entry.values[0]!) : `${entry.values.length} tasks`;
    }
    if (entry.type === "status") {
      return entry.values.length === 1
        ? STATUS_META[entry.values[0] as RunStatus].label
        : `${entry.values.length} statuses`;
    }
    return entry.values.length === 1 ? `"${entry.values[0]}"` : `${entry.values.length} keywords`;
  };

  const rowChip = "flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[12px] text-white/80";
  const popoverInput =
    "w-full rounded border border-clide-border bg-clide-bg px-2 py-1 text-[13px] text-white outline-none placeholder:text-white/20 focus:border-white/30";

  return (
    <Toolbar className="bg-white/10">
      <button
        onClick={openRunPicker}
        title="Run a task (⌘K)"
        className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] text-white/50 transition-colors hover:bg-white/5 hover:text-white [.clide-compact_&]:px-1.5 [.clide-compact_&]:py-1"
      >
        <Play size={13} />
        <span className="[.clide-compact_&]:hidden">Run</span>
      </button>

      <div className="mx-1 h-4 w-px shrink-0 bg-white/10" />

      {entries.map((entry) => (
        <button
          key={entry.id}
          onClick={(e) => openEditPopover(e, entry)}
          className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[12px] text-white/80 hover:bg-white/15"
        >
          <span className="text-white/40">{TYPE_LABEL[entry.type]}:</span>
          <span className="max-w-[160px] truncate">{chipLabel(entry)}</span>
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              removeEntry(entry.id);
            }}
            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full hover:bg-white/10"
          >
            <X size={9} />
          </span>
        </button>
      ))}

      <button
        onClick={openAddPopover}
        title="Add filter"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
      >
        <Plus size={13} />
      </button>

      <PortalPopover
        open={popover !== null}
        anchorRef={anchorRef}
        onClose={() => setPopover(null)}
        className="w-64 overflow-hidden rounded-md border border-clide-border bg-clide-panel p-2 shadow-xl"
      >
        {popover?.mode === "pick-type" && (
          <div className="flex flex-col gap-0.5">
            <span className="px-1.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white/30">Filter by</span>
            {(["task", "status", "keyword"] as FilterEntryType[]).map((type) => (
              <button
                key={type}
                onClick={() => pickType(type)}
                className="rounded px-1.5 py-1 text-left text-[13px] text-white/70 hover:bg-white/5 hover:text-white"
              >
                {TYPE_LABEL[type]}
              </button>
            ))}
          </div>
        )}

        {popover?.mode === "criteria" && popover.type === "task" && (
          <>
            {currentValues.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {currentValues.map((slug) => (
                  <span key={slug} className={rowChip}>
                    <span className="max-w-[140px] truncate">{nameFor(slug)}</span>
                    <button
                      onClick={() =>
                        applyValues(
                          "task",
                          popover.entryId,
                          currentValues.filter((s) => s !== slug),
                        )
                      }
                      title="Remove"
                      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full hover:bg-white/10"
                    >
                      <X size={9} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              autoFocus
              value={taskQuery}
              onChange={(e) => setTaskQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && taskSuggestions[0]) {
                  applyValues("task", popover.entryId, [...currentValues, taskSuggestions[0].meta.slug]);
                  setTaskQuery("");
                }
              }}
              placeholder="Search tasks…"
              className={popoverInput}
            />
            <div className="clide-scroll mt-1 max-h-40 space-y-0.5 overflow-y-auto">
              {taskSuggestions.length === 0 && (
                <div className="px-1 py-0.5 text-[12px] italic text-white/30">No tasks match</div>
              )}
              {taskSuggestions.map((f) => (
                <button
                  key={f.meta.slug}
                  onClick={() => {
                    applyValues("task", popover.entryId, [...currentValues, f.meta.slug]);
                    setTaskQuery("");
                  }}
                  className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[13px] text-white/60 hover:bg-white/5 hover:text-white"
                >
                  {f.meta.name}
                </button>
              ))}
            </div>
          </>
        )}

        {popover?.mode === "criteria" && popover.type === "status" && (
          <div className="flex flex-col gap-0.5">
            {STATUS_OPTIONS.map((s) => {
              const meta = STATUS_META[s];
              const Icon = meta.icon;
              const checked = currentValues.includes(s);
              return (
                <label
                  key={s}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] text-white/70 hover:bg-white/5 hover:text-white"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      applyValues(
                        "status",
                        popover.entryId,
                        checked ? currentValues.filter((x) => x !== s) : [...currentValues, s],
                      )
                    }
                  />
                  <Icon size={12} className={`shrink-0 ${meta.textClass} ${meta.spin ? "animate-spin" : ""}`} />
                  {meta.label}
                </label>
              );
            })}
          </div>
        )}

        {popover?.mode === "criteria" && popover.type === "keyword" && (
          <>
            {currentValues.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {currentValues.map((k) => (
                  <span key={k} className={rowChip}>
                    <span className="max-w-[140px] truncate">{k}</span>
                    <button
                      onClick={() =>
                        applyValues(
                          "keyword",
                          popover.entryId,
                          currentValues.filter((x) => x !== k),
                        )
                      }
                      title="Remove"
                      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full hover:bg-white/10"
                    >
                      <X size={9} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              autoFocus
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const trimmed = keywordInput.trim();
                  setKeywordInput("");
                  if (!trimmed || currentValues.some((k) => k.toLowerCase() === trimmed.toLowerCase())) return;
                  applyValues("keyword", popover.entryId, [...currentValues, trimmed]);
                }
              }}
              placeholder="Type a keyword, press Enter…"
              className={popoverInput}
            />
          </>
        )}
      </PortalPopover>

      <div className="flex-1" />

      <button
        onClick={() => {
          setPopover(null);
          openViewSettings();
        }}
        title="View settings"
        className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[12px] text-white/40 hover:bg-white/5 hover:text-white"
      >
        <EllipsisVertical size={14} />
      </button>
    </Toolbar>
  );
}
