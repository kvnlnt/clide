import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../rpc";
import type { ReportTaskMember, ReportWorkflowMember } from "../../types/tasks";
import Modal from "../Modal";

interface RunOption {
  id: string;
  label: string;
}

interface RunsPickerModalProps {
  member: ReportTaskMember | ReportWorkflowMember;
  onClose: () => void;
  onSave: (runIds: string[]) => void;
}

/**
 * Choose specific runs for a task/workflow report member (ticket 134) — the
 * report stores run ids, not copies, so this only ever picks references.
 * Leaving nothing selected means "most recent run" at export time.
 */
export default function RunsPickerModal({ member, onClose, onSave }: RunsPickerModalProps) {
  const { activeProject } = useApp();
  const [options, setOptions] = useState<RunOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(member.runIds));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      if (member.kind === "task") {
        const runs = await api.getRunHistory(member.taskSlug, 25);
        if (!cancelled) setOptions(runs.map((r) => ({ id: r.id, label: new Date(r.startedAt).toLocaleString() })));
      } else if (activeProject) {
        const runs = await api.listWorkflowRuns(activeProject, member.workflowId);
        if (!cancelled) setOptions(runs.map((r) => ({ id: r.runId, label: new Date(r.startedAt).toLocaleString() })));
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [member, activeProject]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Modal onClose={onClose} widthClassName="w-[420px]" panelClassName="flex max-h-[70vh] flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-clide-border px-4 py-3">
        <span className="text-[14px] font-bold text-white">Choose runs</span>
        <button onClick={onClose} className="text-white/40 hover:text-white">
          <X size={16} />
        </button>
      </div>
      <div className="shrink-0 px-4 pt-3 text-[12px] text-white/40">
        Leave nothing checked to always use the most recent run.
      </div>
      <div className="clide-scroll flex-1 overflow-y-auto px-2 py-2">
        {loading && <div className="px-2 py-4 text-center text-[13px] text-white/30">Loading…</div>}
        {!loading && options.length === 0 && (
          <div className="px-2 py-4 text-center text-[13px] text-white/30">No runs yet.</div>
        )}
        {options.map((o) => (
          <label key={o.id} className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-white/5">
            <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
            <span className="text-[13px] text-white/80">{o.label}</span>
          </label>
        ))}
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-clide-border px-4 py-3">
        <button onClick={onClose} className="rounded-md px-3 py-1.5 text-[13px] text-white/50 hover:bg-white/5">
          Cancel
        </button>
        <button
          onClick={() => onSave(Array.from(selected))}
          className="rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
