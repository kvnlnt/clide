import { useState } from "react";
import type { WorkflowTaskReference } from "../../shared/types";
import { api } from "../rpc";
import Modal from "./Modal";

interface UpgradeWorkflowsModalProps {
  projectPath: string;
  slug: string;
  newVersion: number;
  workflows: WorkflowTaskReference[];
  onClose: () => void;
  onUpgrade: () => void;
}

/**
 * Upgrade confirmation modal shown after saving a new task version (ticket 105).
 * Lists all workflows referencing the task at older versions, lets the user
 * select which to upgrade, then applies the upgrade per workflow via RPC.
 */
export default function UpgradeWorkflowsModal({
  projectPath,
  slug,
  newVersion,
  workflows,
  onClose,
  onUpgrade,
}: UpgradeWorkflowsModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(workflows.map((w) => w.workflowId)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleWorkflow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(workflows.map((w) => w.workflowId)));
  };

  const upgrade = async () => {
    setBusy(true);
    setError(null);

    const results: string[] = [];
    for (const wf of workflows) {
      if (!selected.has(wf.workflowId)) continue;
      const stepNames = Object.keys(wf.steps);
      const res = await api.upgradeWorkflowTaskVersion(projectPath, wf.workflowId, stepNames, newVersion);
      if (!res.ok) {
        results.push(`${wf.workflowName}: ${res.error ?? "failed"}`);
      }
    }

    setBusy(false);
    if (results.length > 0) {
      setError(results.join(", "));
      return;
    }

    onUpgrade();
    onClose();
  };

  return (
    <Modal onClose={onClose} widthClassName="w-[560px]" panelClassName="flex flex-col max-h-[85%]">
      <div className="flex flex-col gap-4 overflow-hidden p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-[16px] font-semibold text-white">Upgrade workflows to v{newVersion}?</h2>
          <p className="text-[13px] text-white/60">
            These workflows reference <span className="text-white/80">{slug}</span> at older versions. Select which
            workflows to upgrade:
          </p>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto">
          {workflows.map((wf) => {
            const stepNames = Object.keys(wf.steps);
            const oldVersions = Array.from(new Set(Object.values(wf.steps).filter((v) => v !== undefined))).sort();
            return (
              <label
                key={wf.workflowId}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-white/5 bg-white/5 p-3 hover:bg-white/[0.08]"
              >
                <input
                  type="checkbox"
                  checked={selected.has(wf.workflowId)}
                  onChange={() => toggleWorkflow(wf.workflowId)}
                  className="mt-0.5 shrink-0"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[13px] font-medium text-white">{wf.workflowName}</span>
                  <span className="text-[12px] text-white/40">
                    {stepNames.length} step{stepNames.length === 1 ? "" : "s"} ({stepNames.join(", ")}) at v
                    {oldVersions.join(", v")}
                  </span>
                </div>
              </label>
            );
          })}
        </div>

        {error && <div className="text-[12px] text-red-400">{error}</div>}

        <div className="flex gap-2">
          <button
            onClick={() => void upgrade()}
            disabled={busy || selected.size === 0}
            className="flex-1 rounded-md bg-white/10 px-4 py-2 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
          >
            {busy ? "Upgrading…" : `Upgrade ${selected.size} workflow${selected.size === 1 ? "" : "s"}`}
          </button>
          <button
            onClick={selectAll}
            disabled={busy}
            className="rounded-md px-4 py-2 text-[13px] text-white/60 hover:bg-white/5 disabled:opacity-40"
          >
            Select all
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md px-4 py-2 text-[13px] text-white/60 hover:bg-white/5 disabled:opacity-40"
          >
            Skip
          </button>
        </div>
      </div>
    </Modal>
  );
}
