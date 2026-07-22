import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  File,
  FileText,
  Plus,
  StickyNote,
  Trash2,
  Workflow as WorkflowIcon,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { useApp } from "../../context/AppContext";
import type { Report, ReportMember, ReportTaskMember, ReportWorkflowMember, TaskFolder, Workflow } from "../../types/tasks";
import Modal, { useEscapeToClose } from "../Modal";
import { useUIFeedback } from "../UIFeedback";
import FilePickerModal from "./FilePickerModal";
import RunsPickerModal from "./RunsPickerModal";

const inputBase =
  "w-full rounded border border-clide-border bg-clide-surface text-white text-[13px] px-2.5 py-1.5 outline-none placeholder:text-white/30 focus:border-white/30";
const fieldLabel = "text-[12px] font-medium text-white/60";

function newId(): string {
  return crypto.randomUUID();
}

/** Pick a project task to add as a member (ticket 134). */
function AddTaskModal({
  tasks,
  onClose,
  onPick,
}: {
  tasks: TaskFolder[];
  onClose: () => void;
  onPick: (task: TaskFolder) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = tasks.filter((t) => t.meta.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <Modal onClose={onClose} widthClassName="w-[420px]" panelClassName="flex max-h-[70vh] flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-clide-border px-4 py-3">
        <span className="text-[14px] font-bold text-white">Add a task</span>
        <button onClick={onClose} className="text-white/40 hover:text-white">
          <X size={16} />
        </button>
      </div>
      <div className="shrink-0 px-4 pt-3">
        <input
          autoFocus
          className={inputBase}
          placeholder="Search tasks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="clide-scroll flex-1 overflow-y-auto px-2 py-2">
        {filtered.length === 0 && <div className="px-2 py-4 text-center text-[13px] text-white/30">No tasks found.</div>}
        {filtered.map((t) => (
          <button
            key={t.meta.slug}
            onClick={() => onPick(t)}
            className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-white/5"
          >
            <span className="text-[13px] text-white">{t.meta.name}</span>
            {t.meta.description && <span className="truncate text-[11px] text-white/40">{t.meta.description}</span>}
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** Pick a project workflow to add as a member (ticket 134). */
function AddWorkflowModal({
  workflows,
  onClose,
  onPick,
}: {
  workflows: Workflow[];
  onClose: () => void;
  onPick: (workflow: Workflow) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = workflows.filter((w) => w.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <Modal onClose={onClose} widthClassName="w-[420px]" panelClassName="flex max-h-[70vh] flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-clide-border px-4 py-3">
        <span className="text-[14px] font-bold text-white">Add a workflow</span>
        <button onClick={onClose} className="text-white/40 hover:text-white">
          <X size={16} />
        </button>
      </div>
      <div className="shrink-0 px-4 pt-3">
        <input
          autoFocus
          className={inputBase}
          placeholder="Search workflows…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="clide-scroll flex-1 overflow-y-auto px-2 py-2">
        {filtered.length === 0 && (
          <div className="px-2 py-4 text-center text-[13px] text-white/30">No workflows found.</div>
        )}
        {filtered.map((w) => (
          <button
            key={w.id}
            onClick={() => onPick(w)}
            className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-white/5"
          >
            <span className="text-[13px] text-white">{w.name}</span>
            {w.description && <span className="truncate text-[11px] text-white/40">{w.description}</span>}
          </button>
        ))}
      </div>
    </Modal>
  );
}

function memberTitle(member: ReportMember): string {
  if (member.kind === "task") return member.taskName;
  if (member.kind === "workflow") return member.workflowName;
  if (member.kind === "file") return member.name;
  return "Note";
}

function memberIcon(kind: ReportMember["kind"]) {
  if (kind === "task") return FileText;
  if (kind === "workflow") return WorkflowIcon;
  if (kind === "file") return File;
  return StickyNote;
}

interface ReportEditorProps {
  initial: Report;
  onClose: () => void;
}

/**
 * Report builder (ticket 134): pick tasks/workflows/files as ordered members,
 * add per-section notes, save. Members REFERENCE their source (slug/id/uri) —
 * the report itself stores no copies, so it renders fresh at export time.
 */
export default function ReportEditor({ initial, onClose }: ReportEditorProps) {
  const { activeProject, tasks, workflows, saveReport } = useApp();
  const { confirm, toast } = useUIFeedback();
  const [report, setReport] = useState<Report>(initial);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addWorkflowOpen, setAddWorkflowOpen] = useState(false);
  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [runsPickerFor, setRunsPickerFor] = useState<ReportTaskMember | ReportWorkflowMember | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  const projectTasks = tasks.filter((t) => t.meta.project === activeProject);
  const dirty = JSON.stringify(report) !== JSON.stringify(initial);

  const requestClose = async () => {
    if (dirty) {
      const res = await confirm({
        title: "Discard report changes?",
        message: "Unsaved edits to this report will be lost.",
        confirmLabel: "Discard",
      });
      if (!res.ok) return;
    }
    onClose();
  };
  useEscapeToClose(() => void requestClose());

  const save = async () => {
    if (!report.name.trim()) {
      setSaveError("Report name is required.");
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    setSaveError(null);
    const res = await saveReport(report);
    setSaving(false);
    if (res.ok) {
      toast("Report saved");
      onClose();
    } else {
      setSaveError(res.error ?? "Save failed");
    }
  };

  const addMember = (member: ReportMember) => setReport((r) => ({ ...r, members: [...r.members, member] }));
  const updateMember = (id: string, patch: Partial<ReportMember>) =>
    setReport((r) => ({
      ...r,
      members: r.members.map((m) => (m.id === id ? ({ ...m, ...patch } as ReportMember) : m)),
    }));
  const removeMember = (id: string) => setReport((r) => ({ ...r, members: r.members.filter((m) => m.id !== id) }));
  const moveMember = (index: number, dir: -1 | 1) =>
    setReport((r) => {
      const next = [...r.members];
      const target = index + dir;
      if (target < 0 || target >= next.length) return r;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...r, members: next };
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-4 px-[var(--clide-page-x)] pb-4 pt-[var(--clide-page-top)]">
        <h1 className="shrink-0 text-[20px] font-bold text-white">{report.name.trim() || "New report"}</h1>
        <div className="flex-1" />
        <button
          onClick={() => void requestClose()}
          title="Close"
          className="flex h-8 w-8 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="clide-scroll min-h-0 flex-1 overflow-y-auto px-8 pb-4">
        <div className="flex w-full max-w-[900px] flex-col gap-5">
          <div className="flex flex-col gap-1">
            <label className={fieldLabel}>Name</label>
            <input
              ref={nameRef}
              className={inputBase}
              value={report.name}
              onChange={(e) => setReport({ ...report, name: e.target.value })}
              placeholder="e.g. Q3 progress report"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={fieldLabel}>Description</label>
            <textarea
              className={`${inputBase} min-h-[60px] resize-y`}
              value={report.description}
              onChange={(e) => setReport({ ...report, description: e.target.value })}
              placeholder="What this report is for, and who it's shared with."
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className={fieldLabel}>Sections</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setAddTaskOpen(true)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-white/60 hover:bg-white/5 hover:text-white"
                >
                  <Plus size={12} /> Task
                </button>
                <button
                  onClick={() => setAddWorkflowOpen(true)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-white/60 hover:bg-white/5 hover:text-white"
                >
                  <Plus size={12} /> Workflow
                </button>
                <button
                  onClick={() => setFilePickerOpen(true)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-white/60 hover:bg-white/5 hover:text-white"
                >
                  <Plus size={12} /> File
                </button>
                <button
                  onClick={() => addMember({ kind: "note", id: newId(), text: "" })}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-white/60 hover:bg-white/5 hover:text-white"
                >
                  <Plus size={12} /> Note
                </button>
              </div>
            </div>

            {report.members.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-clide-border py-10 text-center">
                <ClipboardList size={20} className="text-white/30" />
                <span className="text-[13px] text-white/40">No sections yet — add a task, workflow, file, or note.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {report.members.map((member, index) => {
                  const Icon = memberIcon(member.kind);
                  return (
                    <div key={member.id} className="flex flex-col gap-2 rounded-md border border-clide-border p-3">
                      <div className="flex items-center gap-2">
                        <Icon size={14} className="shrink-0 text-white/40" />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">
                          {memberTitle(member)}
                        </span>
                        {(member.kind === "task" || member.kind === "workflow") && (
                          <button
                            onClick={() => setRunsPickerFor(member)}
                            className="shrink-0 rounded px-2 py-0.5 text-[11px] text-white/50 hover:bg-white/5 hover:text-white"
                          >
                            {member.runIds.length === 0
                              ? "Latest run"
                              : `${member.runIds.length} run${member.runIds.length === 1 ? "" : "s"} selected`}
                          </button>
                        )}
                        <button
                          onClick={() => moveMember(index, -1)}
                          disabled={index === 0}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-20"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          onClick={() => moveMember(index, 1)}
                          disabled={index === report.members.length - 1}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-20"
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          onClick={() => removeMember(member.id)}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-red-400/70 hover:bg-white/10 hover:text-red-400"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {member.kind === "note" ? (
                        <textarea
                          className={`${inputBase} min-h-[60px] resize-y`}
                          value={member.text}
                          onChange={(e) => updateMember(member.id, { text: e.target.value })}
                          placeholder="Note text…"
                        />
                      ) : (
                        <input
                          className={`${inputBase} text-[12px]`}
                          value={member.note ?? ""}
                          onChange={(e) => updateMember(member.id, { note: e.target.value })}
                          placeholder="Section note (optional)"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-clide-border px-8 py-3">
        {saveError && <span className="text-[12px] text-red-300">{saveError}</span>}
        <div className="flex-1" />
        <button onClick={() => void requestClose()} className="rounded-md px-3 py-1.5 text-[13px] text-white/50 hover:bg-white/5">
          Cancel
        </button>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {addTaskOpen && (
        <AddTaskModal
          tasks={projectTasks}
          onClose={() => setAddTaskOpen(false)}
          onPick={(task) => {
            addMember({ kind: "task", id: newId(), taskSlug: task.meta.slug, taskName: task.meta.name, runIds: [] });
            setAddTaskOpen(false);
          }}
        />
      )}

      {addWorkflowOpen && (
        <AddWorkflowModal
          workflows={workflows}
          onClose={() => setAddWorkflowOpen(false)}
          onPick={(workflow) => {
            addMember({ kind: "workflow", id: newId(), workflowId: workflow.id, workflowName: workflow.name, runIds: [] });
            setAddWorkflowOpen(false);
          }}
        />
      )}

      {filePickerOpen && (
        <FilePickerModal
          onClose={() => setFilePickerOpen(false)}
          onPick={(file) => {
            addMember({ kind: "file", id: newId(), uri: file.uri, name: file.name });
            setFilePickerOpen(false);
          }}
        />
      )}

      {runsPickerFor && (
        <RunsPickerModal
          member={runsPickerFor}
          onClose={() => setRunsPickerFor(null)}
          onSave={(runIds) => {
            updateMember(runsPickerFor.id, { runIds });
            setRunsPickerFor(null);
          }}
        />
      )}
    </div>
  );
}
