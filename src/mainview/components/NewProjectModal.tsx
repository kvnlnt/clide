import { FolderOpen, FolderPlus, X } from "lucide-react";
import { useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../rpc";
import Modal from "./Modal";

interface NewProjectModalProps {
  onClose: () => void;
}

type Mode = "new" | "open";

const basename = (p: string) => p.split("/").filter(Boolean).pop() ?? p;
const joinPath = (parent: string, child: string) =>
  `${parent.replace(/\/+$/, "")}/${child}`;
const slugifyFolder = (name: string) => name.trim().replace(/[/\\]+/g, "-");

interface NewProjectFormProps {
  /** Called once a project is successfully created/opened. */
  onDone: () => void;
  /** Omit to hide the Cancel button (e.g. the first-project takeover, ticket 78, has nowhere to cancel back to). */
  onCancel?: () => void;
}

/**
 * The create/open form itself, extracted from the modal chrome (ticket 78)
 * so both the regular "Add project" modal and the full-window first-project
 * takeover can embed the exact same new-vs-existing flow.
 */
export function NewProjectForm({ onDone, onCancel }: NewProjectFormProps) {
  const { createProject } = useApp();
  const [mode, setMode] = useState<Mode>("new");
  const [name, setName] = useState("");
  // "new" mode: optional parent location to create the folder in.
  const [location, setLocation] = useState("");
  // "open" mode: the existing folder being opened.
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const chooseLocation = async () => {
    setBrowsing(true);
    const picked = await api.chooseDirectory(location || undefined);
    setBrowsing(false);
    if (picked) setLocation(picked);
  };

  const chooseFolder = async () => {
    setBrowsing(true);
    const picked = await api.chooseDirectory(path || undefined);
    setBrowsing(false);
    if (picked) {
      setPath(picked);
      if (!name.trim()) setName(basename(picked));
    }
  };

  const canSubmit =
    !submitting &&
    (mode === "new" ? name.trim().length > 0 : path.length > 0);

  const submit = async () => {
    if (mode === "new") {
      const trimmed = name.trim();
      if (!trimmed) {
        setError("Name required");
        return;
      }
      const targetPath = location
        ? joinPath(location, slugifyFolder(trimmed))
        : undefined;
      setSubmitting(true);
      const res = await createProject(trimmed, targetPath);
      setSubmitting(false);
      if (res.ok) onDone();
      else setError(res.error ?? "Failed to create project");
      return;
    }

    // open mode
    if (!path) {
      setError("Choose a folder");
      return;
    }
    setSubmitting(true);
    const res = await createProject(name.trim() || basename(path), path);
    setSubmitting(false);
    if (res.ok) onDone();
    else setError(res.error ?? "Failed to open project");
  };

  const inputBase =
    "w-full rounded-md border border-clide-border bg-clide-surface px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30";

  return (
    <>
      {/* Mode toggle */}
      <div className="flex gap-1 px-5 pt-4">
        <button
          onClick={() => switchMode("new")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium ${
            mode === "new"
              ? "bg-white/10 text-white"
              : "text-white/50 hover:bg-white/5 hover:text-white/80"
          }`}
        >
          <FolderPlus size={14} />
          New
        </button>
        <button
          onClick={() => switchMode("open")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium ${
            mode === "open"
              ? "bg-white/10 text-white"
              : "text-white/50 hover:bg-white/5 hover:text-white/80"
          }`}
        >
          <FolderOpen size={14} />
          Open
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-3 px-5 py-4">
        {mode === "new" ? (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-white/60">
                Project name
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSubmit) void submit();
                }}
                placeholder="My project"
                className={inputBase}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-white/60">
                Location
              </label>
              <button
                type="button"
                disabled={browsing}
                onClick={() => void chooseLocation()}
                className="flex items-center gap-1.5 rounded-md border border-clide-border bg-clide-surface px-2.5 py-1.5 text-left text-[13px] text-white/80 hover:border-white/30 disabled:opacity-40"
              >
                <FolderOpen size={13} className="shrink-0 text-white/40" />
                <span className="truncate">
                  {location || "Default location"}
                </span>
              </button>
              <span className="text-[11px] text-white/30">
                {location
                  ? `Creates ${joinPath(location, slugifyFolder(name) || "…")}`
                  : "A folder is created under the app's projects directory."}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-white/60">
                Folder
              </label>
              {path ? (
                <div className="flex items-center gap-1.5 rounded-md border border-clide-border bg-clide-surface px-2.5 py-1.5">
                  <FolderOpen size={13} className="shrink-0 text-white/40" />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-[13px] text-white" title={path}>
                      {basename(path)}
                    </div>
                    <div className="truncate text-[11px] text-white/30" title={path}>
                      {path}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={browsing}
                    onClick={() => void chooseFolder()}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-40"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={browsing}
                  onClick={() => void chooseFolder()}
                  className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-clide-border bg-clide-surface px-2.5 py-2 text-[13px] text-white/60 hover:border-white/30 hover:text-white disabled:opacity-40"
                >
                  <FolderOpen size={14} />
                  Choose folder…
                </button>
              )}
            </div>
            {path && (
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-white/60">
                  Project name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canSubmit) void submit();
                  }}
                  placeholder={basename(path)}
                  className={inputBase}
                />
              </div>
            )}
          </>
        )}

        {error && <span className="text-[11px] text-red-400">{error}</span>}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t border-clide-border px-5 py-3">
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-[13px] text-white/50 hover:bg-white/5 hover:text-white"
          >
            Cancel
          </button>
        )}
        <button
          onClick={() => void submit()}
          disabled={!canSubmit}
          className="rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
        >
          {mode === "new" ? "Create" : "Open"}
        </button>
      </div>
    </>
  );
}

export default function NewProjectModal({ onClose }: NewProjectModalProps) {
  return (
    <Modal onClose={onClose} widthClassName="w-[460px]" panelClassName="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-clide-border px-5 py-4">
        <span className="text-[14px] font-bold text-white">Add project</span>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"
        >
          <X size={14} />
        </button>
      </div>

      <NewProjectForm onDone={onClose} onCancel={onClose} />
    </Modal>
  );
}
