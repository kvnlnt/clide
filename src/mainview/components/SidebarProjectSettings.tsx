import { FolderOpen, Trash2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../rpc";

interface SidebarProjectSettingsProps {
  path: string;
  name: string;
  onClose: () => void;
}

export default function SidebarProjectSettings({ path, name, onClose }: SidebarProjectSettingsProps) {
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

  const inputCls =
    "rounded-md border border-clide-border bg-clide-surface px-2 py-1 text-[13px] text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none";

  return (
    <div className="mx-1 mb-1.5 flex flex-col gap-2 rounded-md border border-clide-border bg-clide-surface/60 p-2">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-white/40">Name</span>
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") onClose();
          }}
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-white/40">Folder</span>
        <div className="flex items-center gap-1.5 rounded-md border border-clide-border bg-clide-surface px-2 py-1">
          <span className="min-w-0 flex-1 truncate text-[12px] text-white/70" title={path}>
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
      <div className="flex gap-1.5">
        <button
          disabled={busy}
          onClick={() => void save()}
          className="flex-1 rounded-md bg-white/10 px-2 py-1 text-[12px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
        >
          Save
        </button>
        <button onClick={onClose} className="rounded-md px-2 py-1 text-[12px] text-white/50 hover:bg-white/5">
          Cancel
        </button>
      </div>

      <div className="mt-1 border-t border-white/5 pt-2">
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
                className="flex-1 rounded-md bg-red-500/80 px-2 py-1 text-[12px] font-medium text-white hover:bg-red-500 disabled:opacity-40"
              >
                Remove
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-md px-2 py-1 text-[12px] text-white/50 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
