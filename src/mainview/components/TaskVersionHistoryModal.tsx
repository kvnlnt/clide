import { Clock, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { TaskVersionInfo } from "../../shared/types";
import { api } from "../rpc";
import Modal from "./Modal";
import { useUIFeedback } from "./UIFeedback";

interface TaskVersionHistoryModalProps {
  projectPath: string;
  slug: string;
  currentVersion: number;
  onClose: () => void;
  onRollback: () => void;
}

/**
 * Version history modal for a task (ticket 105). Shows all versions with
 * metadata, and allows rolling back to an old version by creating a new
 * version copied from it.
 */
export default function TaskVersionHistoryModal({
  projectPath,
  slug,
  currentVersion,
  onClose,
  onRollback,
}: TaskVersionHistoryModalProps) {
  const { confirm, toast } = useUIFeedback();
  const [versions, setVersions] = useState<TaskVersionInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load versions on mount
  useState(() => {
    void (async () => {
      const res = await api.listTaskVersions(projectPath, slug);
      if (res.ok && res.versions) {
        // Sort descending by version
        setVersions(res.versions.sort((a, b) => b.version - a.version));
      } else {
        setError(res.error ?? "Failed to load versions");
      }
    })();
  });

  const rollback = async (version: number) => {
    const res = await confirm({
      title: `Roll back to v${version}?`,
      message: `This will create a new version (v${currentVersion + 1}) with the definition from v${version}. The current version stays unchanged.`,
      confirmLabel: "Roll back",
    });
    if (!res.ok) return;

    setBusy(true);
    setError(null);
    const result = await api.rollbackTaskVersion(projectPath, slug, version);
    setBusy(false);

    if (result.ok) {
      toast(`Rolled back to v${version} as v${result.newVersion}`);
      onRollback();
      onClose();
    } else {
      setError(result.error ?? "Rollback failed");
    }
  };

  return (
    <Modal onClose={onClose} widthClassName="w-[520px]" panelClassName="flex flex-col max-h-[85%]">
      <div className="flex flex-col gap-4 overflow-hidden p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-[16px] font-semibold text-white">Version History</h2>
          <p className="text-[13px] text-white/60">
            <span className="text-white/80">{slug}</span> — current version: v{currentVersion}
          </p>
        </div>

        {error && !versions && <div className="text-[13px] text-red-400">{error}</div>}

        {!versions && !error && <div className="text-[13px] text-white/40">Loading versions…</div>}

        {versions && versions.length === 0 && <div className="text-[13px] text-white/40">No versions found.</div>}

        {versions && versions.length > 0 && (
          <div className="flex flex-col gap-2 overflow-y-auto">
            {versions.map((v) => {
              const isCurrent = v.version === currentVersion;
              const date = new Date(v.createdAt).toLocaleString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div
                  key={v.version}
                  className={`flex items-start gap-3 rounded-md border p-3 ${
                    isCurrent ? "border-white/20 bg-white/[0.08]" : "border-white/5 bg-white/5"
                  }`}
                >
                  <Clock size={14} className="mt-0.5 shrink-0 text-white/40" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-white">v{v.version}</span>
                      {isCurrent && <span className="text-[11px] text-white/40">(current)</span>}
                      {v.lifecycle === "draft" && (
                        <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                          draft
                        </span>
                      )}
                      {v.lifecycle === "adopted" && <span className="text-[11px] text-white/30">🔒</span>}
                    </div>
                    <span className="text-[11px] text-white/40">{date}</span>
                  </div>
                  {!isCurrent && (
                    <button
                      onClick={() => void rollback(v.version)}
                      disabled={busy}
                      title="Make this latest"
                      className="flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1.5 text-[11px] text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-40"
                    >
                      <RotateCcw size={11} />
                      Roll back
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {error && versions && <div className="text-[12px] text-red-400">{error}</div>}

        <div className="flex justify-end">
          <button onClick={onClose} className="rounded-md px-4 py-2 text-[13px] text-white/60 hover:bg-white/5">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
