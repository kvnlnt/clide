import { FolderOpen, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../rpc";

interface ProjectSettingsModalProps {
  path: string;
  name: string;
  onClose: () => void;
}

export default function ProjectSettingsModal({ path, name, onClose }: ProjectSettingsModalProps) {
  const { renameProject, deleteProject } = useApp();
  const [newName, setNewName] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("Name required");
      return;
    }
    setBusy(true);
    const res = await renameProject(path, trimmed);
    setBusy(false);
    if (res.ok) {
      onClose();
    } else {
      setError(res.error ?? "Rename failed");
    }
  };

  const remove = async () => {
    setBusy(true);
    await deleteProject(path);
    setBusy(false);
    onClose();
  };

  const containingFolder = (p: string) => {
    const trimmed = p.replace(/\/+$/, "");
    const idx = trimmed.lastIndexOf("/");
    return idx > 0 ? trimmed.slice(0, idx) : "/";
  };

  const inputBase =
    "w-full rounded-md border border-clide-border bg-clide-surface px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30";

  return (
    <div className="clide-scroll flex flex-1 justify-center overflow-y-auto p-6">
      <div className="h-fit w-[560px] overflow-hidden rounded-lg border border-clide-border bg-clide-panel">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-clide-border px-5 py-4">
          <span className="text-[14px] font-bold text-white">Project settings</span>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        {/* Tabs removed — forms management lives in the Forms panel (⌘P). */}

        {/* Body */}
        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-white/60">Name</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
                if (e.key === "Escape") onClose();
              }}
              className={inputBase}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-white/60">Folder</label>
            <div className="flex items-center gap-1.5 rounded-md border border-clide-border bg-clide-surface px-2.5 py-1.5">
              <FolderOpen size={13} className="shrink-0 text-white/40" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-white/70" title={path}>
                {path}
              </span>
              <button
                type="button"
                onClick={() => void api.openFolder(path)}
                title="Reveal folder in Finder"
                className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-white/50 hover:bg-white/10 hover:text-white"
              >
                <FolderOpen size={12} />
                Reveal
              </button>
            </div>
          </div>

          {error && <span className="text-[11px] text-red-400">{error}</span>}

          {/* Danger zone */}
          <div className="mt-1 border-t border-white/5 pt-3">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-[12px] text-red-400/80 hover:text-red-400"
              >
                <Trash2 size={13} />
                Delete project
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="text-[12px] text-white/70">Remove “{name}” from CLIDE?</span>
                <span className="text-[11px] text-white/40">
                  Files on disk are kept. To delete them,{" "}
                  <button
                    type="button"
                    onClick={() => void api.openFolder(containingFolder(path))}
                    className="text-white/60 underline underline-offset-2 hover:text-white"
                  >
                    open the containing folder
                  </button>{" "}
                  and remove it yourself.
                </span>
                <div className="flex gap-1.5">
                  <button
                    disabled={busy}
                    onClick={() => void remove()}
                    className="rounded-md bg-red-500/80 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-red-500 disabled:opacity-40"
                  >
                    Remove
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-md px-3 py-1.5 text-[12px] text-white/50 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-clide-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-[13px] text-white/50 hover:bg-white/5 hover:text-white"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={() => void save()}
            className="rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
