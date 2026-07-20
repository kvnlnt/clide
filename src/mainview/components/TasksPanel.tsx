import { CheckCircle, FolderOpen, Globe, History, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { useTaskSearch } from "../hooks/useTaskSearch";
import { api } from "../rpc";
import type { TaskFolder } from "../types/tasks";
import BrowserStepsEditorModal from "./BrowserStepsEditorModal";
import TaskVersionHistoryModal from "./TaskVersionHistoryModal";
import { useUIFeedback } from "./UIFeedback";

/**
 * Unified tasks management surface for the active project (or all projects
 * when no project is active): fuzzy search, AI-powered create, metadata edit,
 * and delete — rendered as a full-width page. Opened via ⌘P or the project
 * toolbar's Tasks button. Managing only (ticket 113): running a task lives in
 * the ⌘K picker and Quick-Run, never behind a row click here.
 */
export default function TasksPanel() {
  const {
    forms,
    recentSlugs,
    openNewForm,
    setProjectSurface,
    activeProject,
    deleteForm,
    updateTaskMeta,
  } = useApp();
  const scopedForms = activeProject ? forms.filter((f) => f.meta.project === activeProject) : forms;
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useTaskSearch(scopedForms, query, recentSlugs);
  const createIndex = results.length; // "Create new form" sits after results.
  const total = results.length + 1;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query]);

  // Selecting a row manages the task (opens its edit surface) — it must never
  // create or run anything (ticket 113).
  const choose = (index: number) => {
    if (index === createIndex) {
      openNewForm();
      return;
    }
    const form = results[index];
    if (form) setEditingSlug((cur) => (cur === form.meta.slug ? null : form.meta.slug));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + total) % total);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (query.trim() !== "") setQuery("");
      else setProjectSurface("thread");
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-baseline gap-2 px-8 pb-4 pt-7 justify-between">
        <div className="flex flex-row items-baseline gap-3">
          <h1 className="text-[20px] font-bold text-white">Tasks</h1>
          <span className="text-[13px] text-white/40">{activeProject ?? "All projects"}</span>
        </div>
        <div>
          <button
            onClick={() => choose(createIndex)}
            onMouseEnter={() => setActive(createIndex)}
            className={`mt-1 flex items-center gap-2 rounded-md px-3 py-2.5 text-[14px] ${
              active === createIndex ? "bg-[rgba(86,86,86,0.3)]" : "hover:bg-white/5"
            }`}
          >
            <Plus size={15} className="text-white/60" />
            <span className="italic text-white/70">Create Task</span>
          </button>
        </div>
      </div>

      <div className="px-8 pb-4">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search tasks…"
          className="w-full rounded-md border border-clide-border bg-clide-surface px-4 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-white/30"
        />
      </div>

      <div className="clide-scroll flex-1 overflow-y-auto px-8 pb-8">
        {results.length === 0 && query.trim() !== "" && (
          <div className="px-1 py-3 text-[13px] italic text-white/30">No tasks match "{query}"</div>
        )}
        {results.length > 0 && (
          <div className="flex flex-col divide-y divide-white/5 border-t border-white/5">
            {results.map((form, i) => (
              <TasksPanelRow
                key={form.meta.slug}
                form={form}
                active={active === i}
                showProject={!activeProject}
                editing={editingSlug === form.meta.slug}
                onSelect={() => choose(i)}
                onHover={() => setActive(i)}
                onEdit={() => {
                  setEditingSlug((cur) => (cur === form.meta.slug ? null : form.meta.slug));
                }}
                onCloseEditors={() => {
                  setEditingSlug(null);
                }}
                deleteForm={deleteForm}
                updateTaskMeta={updateTaskMeta}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface TasksPanelRowProps {
  form: TaskFolder;
  active: boolean;
  showProject: boolean;
  editing: boolean;
  onSelect: () => void;
  onHover: () => void;
  onEdit: () => void;
  onCloseEditors: () => void;
  deleteForm: (projectPath: string, slug: string) => Promise<{ ok: boolean; error?: string }>;
  updateTaskMeta: (
    projectPath: string,
    slug: string,
    patch: { name?: string; description?: string; tags?: string[] },
  ) => Promise<{ ok: boolean; error?: string }>;
}

function TasksPanelRow({
  form,
  active,
  showProject,
  editing,
  onSelect,
  onHover,
  onEdit,
  onCloseEditors,
  deleteForm,
  updateTaskMeta,
}: TasksPanelRowProps) {
  const { confirm, toast } = useUIFeedback();
  const { workflows, runs, refreshForms } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [stepsEditorOpen, setStepsEditorOpen] = useState(false);
  const [dismissedAdopt, setDismissedAdopt] = useState(false);

  // "Starts workflows" (ticket 90): visible wherever the form is managed.
  const startsWorkflows = workflows.filter(
    (w) => w.enabled && w.triggers.some((t) => t.type === "task-submitted" && t.taskSlug === form.meta.slug),
  );

  // Check if task has a successful run (for adoption affordance)
  const hasSuccessfulRun = runs.some((r) => r.taskSlug === form.meta.slug && r.status === "success");
  const showAdoptAffordance = form.meta.lifecycle === "draft" && hasSuccessfulRun && !dismissedAdopt;

  const adopt = async () => {
    setBusy(true);
    setError(null);
    const res = await api.adoptTask(form.projectPath, form.meta.slug);
    setBusy(false);
    if (res.ok) {
      toast("Task adopted");
      await refreshForms();
    } else {
      setError(res.error ?? "Adoption failed");
    }
  };

  const remove = async () => {
    // Check for workflow references
    const refs = await api.getWorkflowsReferencingTask(form.projectPath, form.meta.slug);
    let message = "Files on disk are removed and history cards in the thread lose their form.";
    if (refs.workflows.length > 0) {
      const workflowNames = refs.workflows.map((w) => w.workflowName).join(", ");
      message += ` WARNING: This task is pinned by ${refs.workflows.length} workflow${refs.workflows.length === 1 ? "" : "s"}: ${workflowNames}`;
    }

    const res = await confirm({
      title: `Delete task "${form.meta.name}"?`,
      message,
      confirmLabel: "Delete",
    });
    if (!res.ok) return;
    setBusy(true);
    const result = await deleteForm(form.projectPath, form.meta.slug);
    setBusy(false);
    if (result.ok) toast("Task deleted");
    else toast(result.error ?? "Delete failed", "error");
  };

  return (
    <div className={`group ${active ? "bg-[rgba(86,86,86,0.3)]" : "hover:bg-white/5"}`} onMouseEnter={onHover}>
      <div className="flex w-full items-center gap-4 px-3 py-2.5">
        <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-4 text-left">
          <div className="flex w-[220px] shrink-0 items-center gap-2">
            <span className="truncate text-[14px] text-white">{form.meta.name}</span>
            <span className="text-[11px] text-white/40">v{form.meta.version}</span>
            {form.meta.lifecycle === "draft" ? (
              <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[9px] font-medium text-yellow-400">
                draft
              </span>
            ) : (
              <Lock size={10} className="text-white/30" />
            )}
            {form.task.engine === "native" && (
              <span className="rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-medium text-purple-400">
                native
              </span>
            )}
          </div>
          <span className="min-w-0 flex-1 truncate text-[12px] text-white/40">{form.meta.description || "—"}</span>
          {form.meta.tags.length > 0 && (
            <span className="w-[160px] shrink-0 truncate text-[11px] text-white/30">{form.meta.tags.join(" · ")}</span>
          )}
          {showProject && (
            <span className="w-[100px] shrink-0 truncate text-[12px] text-clide-muted">{form.meta.project}</span>
          )}
        </button>
        <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            title="Edit name, description & tags"
            className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={() => void api.openFolder(`${form.projectPath}/forms/${form.meta.slug}`)}
            title="Reveal folder in Finder"
            className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"
          >
            <FolderOpen size={13} />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            title="Delete task"
            className="flex h-6 w-6 items-center justify-center rounded text-red-400/70 hover:bg-white/10 hover:text-red-400 disabled:opacity-40"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {error && <div className="px-3 pb-2 text-[11px] text-red-400">{error}</div>}

      {showAdoptAffordance && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2">
          <CheckCircle size={14} className="shrink-0 text-blue-400" />
          <span className="flex-1 text-[12px] text-blue-300">
            This task has run successfully. Ready to adopt it? Adoption locks this version; future edits create new
            versions.
          </span>
          <button
            onClick={() => void adopt()}
            disabled={busy}
            className="rounded-md bg-blue-500/20 px-2.5 py-1 text-[11px] font-medium text-blue-300 hover:bg-blue-500/30 disabled:opacity-40"
          >
            Adopt
          </button>
          <button onClick={() => setDismissedAdopt(true)} className="text-[11px] text-blue-300/60 hover:text-blue-300">
            Dismiss
          </button>
        </div>
      )}

      {startsWorkflows.length > 0 && (
        <div className="px-3 pb-2 text-[11px] text-white/40">
          Starts workflow{startsWorkflows.length === 1 ? "" : "s"} when it finishes:{" "}
          <span className="text-white/60">{startsWorkflows.map((w) => w.name).join(", ")}</span>
        </div>
      )}

      {editing && (
        <TaskMetaEditor
          form={form}
          busy={busy}
          onSave={async (patch) => {
            setBusy(true);
            setError(null);
            const res = await updateTaskMeta(form.projectPath, form.meta.slug, patch);
            setBusy(false);
            if (res.ok) {
              onCloseEditors();
            } else {
              setError(res.error ?? "Save failed");
            }
          }}
          onCancel={onCloseEditors}
          // Task-level actions live in the edit form, not a row menu (ticket 112).
          actions={
            <>
              {form.meta.lifecycle === "draft" && hasSuccessfulRun && (
                <button
                  onClick={() => void adopt()}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  <CheckCircle size={12} />
                  Adopt task
                </button>
              )}
              {form.task.engine === "native" && form.task.nativeTool === "browser-automation" && (
                <button
                  onClick={() => setStepsEditorOpen(true)}
                  className="flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <Globe size={12} />
                  Edit steps
                </button>
              )}
              <button
                onClick={() => setVersionHistoryOpen(true)}
                className="flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10 hover:text-white"
              >
                <History size={12} />
                Version history
              </button>
            </>
          }
        />
      )}

      {versionHistoryOpen && (
        <TaskVersionHistoryModal
          projectPath={form.projectPath}
          slug={form.meta.slug}
          currentVersion={form.meta.version}
          onClose={() => setVersionHistoryOpen(false)}
          onRollback={async () => {
            await refreshForms();
          }}
        />
      )}

      {stepsEditorOpen && (
        <BrowserStepsEditorModal
          folder={form}
          onClose={() => setStepsEditorOpen(false)}
          onSave={() => {
            setStepsEditorOpen(false);
            void refreshForms();
          }}
        />
      )}
    </div>
  );
}

interface TaskMetaEditorProps {
  form: TaskFolder;
  busy: boolean;
  onSave: (patch: { name?: string; description?: string; tags?: string[] }) => Promise<void>;
  onCancel: () => void;
  /** Task-level actions (adopt, version history, edit steps) rendered as part of the form (ticket 112). */
  actions?: React.ReactNode;
}

function TaskMetaEditor({ form, busy, onSave, onCancel, actions }: TaskMetaEditorProps) {
  const [name, setName] = useState(form.meta.name);
  const [description, setDescription] = useState(form.meta.description);
  const [tags, setTags] = useState(form.meta.tags.join(", "));
  const [error, setError] = useState<string | null>(null);

  const inputBase =
    "w-full rounded-md border border-clide-border bg-clide-bg px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30";

  const save = async () => {
    if (name.trim() === "") {
      setError("Name required");
      return;
    }
    await onSave({
      name: name.trim(),
      description,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t !== ""),
    });
  };

  return (
    <div
      className="mx-3 mb-2 flex max-w-[560px] flex-col gap-2 rounded-md border border-white/5 bg-clide-surface px-2.5 py-2"
      onKeyDown={(e) => {
        // Keep panel-level palette navigation out of the edit form.
        e.stopPropagation();
        if (e.key === "Escape") onCancel();
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-white/50">Name</label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputBase} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-white/50">Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputBase} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-white/50">Tags (comma-separated)</label>
        <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputBase} />
      </div>
      <span className="text-[11px] text-white/30">
        Fields and the script are edited on disk — use “Reveal folder in Finder”.
      </span>
      {actions && <div className="flex flex-wrap gap-1.5 border-t border-white/5 pt-2">{actions}</div>}
      {error && <span className="text-[11px] text-red-400">{error}</span>}
      <div className="flex gap-1.5">
        <button
          disabled={busy}
          onClick={() => void save()}
          className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
        >
          Save
        </button>
        <button onClick={onCancel} className="rounded-md px-2.5 py-1 text-[11px] text-white/50 hover:bg-white/5">
          Cancel
        </button>
      </div>
    </div>
  );
}
