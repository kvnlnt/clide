import { FileText, Plus, Search, Workflow as WorkflowIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { useTaskSearch } from "../hooks/useTaskSearch";
import { api } from "../rpc";
import type { Workflow } from "../types/tasks";
import Modal from "./Modal";
import { useUIFeedback } from "./UIFeedback";

interface RunPickerProps {
  onClose: () => void;
}

type Entry =
  | { kind: "task"; slug: string; name: string; description: string }
  | { kind: "workflow"; workflow: Workflow };

/**
 * The ⌘K run dialog (ticket 93): one search over tasks AND workflows,
 * grouped under labeled sections with per-row type distinction. Picking a
 * task drops a draft card; picking a workflow starts a manual run. Distinct
 * "New task…" / "New workflow…" actions live in the footer.
 */
export default function RunPicker({ onClose }: RunPickerProps) {
  const {
    tasks,
    recentSlugs,
    addTaskDraft,
    activeProject,
    openNewTask,
    openWorkflowEditor,
    workflows,
    setProjectSurface,
    pendingSpeechQuery,
    consumePendingSpeechQuery,
  } = useApp();
  const { toast } = useUIFeedback();
  const scopedTasks = activeProject ? tasks.filter((f) => f.meta.project === activeProject) : tasks;
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const taskResults = useTaskSearch(scopedTasks, query, recentSlugs);
  const workflowResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return workflows.filter(
      (w) => q === "" || w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q),
    );
  }, [workflows, query]);

  // One flat keyboard-navigable list in visual order: tasks section, then workflows.
  const entries: Entry[] = useMemo(
    () => [
      ...taskResults.map(
        (f): Entry => ({ kind: "task", slug: f.meta.slug, name: f.meta.name, description: f.meta.description }),
      ),
      ...workflowResults.map((w): Entry => ({ kind: "workflow", workflow: w })),
    ],
    [taskResults, workflowResults],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Ticket 123: a recognized voice command seeds the search — read once on
  // mount (the picker is remounted fresh each time it opens) then cleared,
  // so it never reappears on a later manual open.
  useEffect(() => {
    if (pendingSpeechQuery) {
      setQuery(pendingSpeechQuery);
      consumePendingSpeechQuery();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const choose = async (index: number) => {
    const entry = entries[index];
    if (!entry) return;
    if (entry.kind === "task") {
      addTaskDraft(entry.slug);
      onClose();
      return;
    }
    // Workflow: start a manual run and land on the Workflows surface.
    const w = entry.workflow;
    if (!w.enabled) {
      toast("This workflow is disabled — enable it from the Workflows page.", "error");
      return;
    }
    if ((w.params ?? []).length > 0) {
      // Parameterized runs prompt on the Workflows page — send the user there.
      setProjectSurface("workflows");
      onClose();
      return;
    }
    if (activeProject) {
      const res = await api.startWorkflowRun(activeProject, w.id, {});
      if (res.ok) toast(`Started "${w.name}"`);
      else toast(res.error ?? "Couldn't start the workflow", "error");
      setProjectSurface("workflows");
    }
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % Math.max(entries.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + Math.max(entries.length, 1)) % Math.max(entries.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      void choose(active);
    }
    // Escape is handled by Modal — window-level, focus-independent.
  };

  const rowClass = (selected: boolean) =>
    `flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] ${
      selected ? "bg-[rgba(86,86,86,0.3)]" : "hover:bg-white/5"
    }`;

  const sectionHeader = (label: string) => (
    <div className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-white/30">{label}</div>
  );

  let flatIndex = -1;

  return (
    <Modal
      onClose={onClose}
      widthClassName="w-[520px]"
      backdropClassName="pt-24"
      panelClassName="flex max-h-[70%] flex-col overflow-hidden"
    >
      {/* Search first. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-clide-border px-4 py-3">
        <Search size={14} className="shrink-0 text-white/30" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Run a task or workflow…"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/30"
        />
      </div>

      {/* Results, sectioned. */}
      <div className="clide-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
        {entries.length === 0 && (
          <div className="px-3 py-3 text-[13px] italic text-white/30">
            {query.trim() ? `Nothing matches “${query}”` : "Nothing to run yet."}
          </div>
        )}

        {taskResults.length > 0 && sectionHeader("Tasks")}
        {taskResults.map((task) => {
          flatIndex++;
          const i = flatIndex;
          return (
            <button
              key={task.meta.slug}
              onClick={() => void choose(i)}
              onMouseEnter={() => setActive(i)}
              className={rowClass(active === i)}
            >
              <FileText size={14} className="shrink-0 text-white/40" />
              <span className="min-w-0 truncate text-white">{task.meta.name}</span>
              {task.meta.description && (
                <span className="min-w-0 shrink truncate text-[12px] text-white/40">{task.meta.description}</span>
              )}
            </button>
          );
        })}

        {workflowResults.length > 0 && sectionHeader("Workflows")}
        {workflowResults.map((w) => {
          flatIndex++;
          const i = flatIndex;
          return (
            <button
              key={w.id}
              onClick={() => void choose(i)}
              onMouseEnter={() => setActive(i)}
              className={rowClass(active === i)}
            >
              <WorkflowIcon size={14} className="shrink-0 text-orange-300/70" />
              <span className="min-w-0 truncate text-white">{w.name}</span>
              <span className="shrink-0 rounded-full bg-orange-400/10 px-1.5 py-0.5 text-[10px] uppercase text-orange-300/70">
                workflow
              </span>
              {!w.enabled && <span className="shrink-0 text-[11px] text-white/30">disabled</span>}
              {w.description && (
                <span className="min-w-0 shrink truncate text-[12px] text-white/40">{w.description}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Distinct create actions (ticket 93) — a footer bar, not look-alike rows. */}
      <div className="flex shrink-0 items-center gap-2 border-t border-clide-border px-3 py-2.5">
        <button
          onClick={() => {
            onClose();
            openNewTask();
          }}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-white/60 hover:bg-white/5 hover:text-white"
        >
          <Plus size={13} /> New task…
        </button>
        <button
          onClick={() => {
            onClose();
            openWorkflowEditor();
          }}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-white/60 hover:bg-white/5 hover:text-white"
        >
          <Plus size={13} /> New workflow…
        </button>
      </div>
    </Modal>
  );
}
