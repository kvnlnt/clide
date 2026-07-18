import { FolderOpen, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../rpc";
import { useUIFeedback } from "./UIFeedback";

interface ProjectSettingsPageProps {
  path: string;
  name: string;
  /** Called after a successful rename or delete — returns the caller to the thread surface. */
  onDone: () => void;
}

/**
 * Project settings as a full-width page (no modal chrome): pinned header,
 * body sections capped for readability. Leaving the page is done via the
 * project toolbar's Settings button, not a ×.
 */
export default function ProjectSettingsPage({ path, name, onDone }: ProjectSettingsPageProps) {
  const { renameProject, deleteProject } = useApp();
  const { confirm, toast } = useUIFeedback();
  const [newName, setNewName] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trackUnread, setTrackUnread] = useState(true);

  // Load trackUnread setting on mount
  useEffect(() => {
    void api.getTrackUnread(path).then(setTrackUnread);
  }, [path]);

  const save = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("Name required");
      return;
    }
    if (trimmed === name) return;
    setBusy(true);
    const res = await renameProject(path, trimmed);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Rename failed");
  };

  const remove = async () => {
    const res = await confirm({
      title: `Remove "${name}" from CLIDE?`,
      message: "Files on disk are kept — only the project registration is removed. Delete the folder yourself if you want it gone.",
      confirmLabel: "Remove",
    });
    if (!res.ok) return;
    setBusy(true);
    await deleteProject(path);
    setBusy(false);
    toast("Project removed");
    onDone();
  };

  const containingFolder = (p: string) => {
    const trimmed = p.replace(/\/+$/, "");
    const idx = trimmed.lastIndexOf("/");
    return idx > 0 ? trimmed.slice(0, idx) : "/";
  };

  const inputBase =
    "w-full rounded-md border border-clide-border bg-clide-surface px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-baseline gap-2 px-8 pb-4 pt-7">
        <h1 className="text-[20px] font-bold text-white">Settings</h1>
        <span className="text-[13px] text-white/40">{name}</span>
      </div>

      <div className="clide-scroll flex-1 overflow-y-auto px-8 pb-8">
        <div className="flex w-full max-w-[560px] flex-col gap-6">
          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-bold uppercase tracking-wider text-white/40">Project</span>

            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-white/80">Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void save();
                  if (e.key === "Escape") setNewName(name);
                }}
                className={inputBase}
              />
              {error && <span className="text-[11px] text-red-400">{error}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-white/80">Folder</label>
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

            <div className="flex">
              <button
                onClick={() => void save()}
                disabled={busy || newName.trim() === name}
                className="rounded-md bg-white/10 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/5 pt-4">
            <span className="text-[12px] font-bold uppercase tracking-wider text-white/40">Results</span>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={trackUnread}
                onChange={async (e) => {
                  const next = e.target.checked;
                  setTrackUnread(next);
                  await api.setTrackUnread(path, next);
                }}
                className="h-4 w-4 rounded border-white/20 bg-clide-surface text-white focus:ring-0 focus:ring-offset-0"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium text-white/80">Track unread results</span>
                <span className="text-[12px] text-white/40">
                  Show a badge when runs finish in this project
                </span>
              </div>
            </label>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/5 pt-4">
            <span className="text-[12px] font-bold uppercase tracking-wider text-white/40">Danger zone</span>
            <button
              disabled={busy}
              onClick={() => void remove()}
              className="flex items-center gap-1.5 self-start text-[13px] text-red-400/80 hover:text-red-400 disabled:opacity-40"
            >
              <Trash2 size={14} />
              Delete project
            </button>
            <span className="text-[12px] text-white/40">
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
          </div>
        </div>
      </div>
    </div>
  );
}
