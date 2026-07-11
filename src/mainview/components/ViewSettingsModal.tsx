import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import type { ThreadView } from "../types/forms";

interface Props {
  view: ThreadView;
  onClose: () => void;
}

/**
 * Rename / hide / delete for a view tab, launched from the kebab menu in
 * ViewToolbar (ticket 50). Rendered at the Workspace top level so its
 * backdrop dims the whole window, same convention as NewProjectModal.
 */
export default function ViewSettingsModal({ view, onClose }: Props) {
  const { updateView, deleteView, setActiveView, activeViewId } = useApp();
  const [name, setName] = useState(view.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === view.name) {
      setName(view.name);
      return;
    }
    updateView({ ...view, name: trimmed });
  };

  const hide = () => {
    updateView({ ...view, hidden: true });
    if (view.id === activeViewId) setActiveView(null);
    onClose();
  };

  const remove = () => {
    deleteView(view.id);
    onClose();
  };

  const inputBase =
    "w-full rounded-md border border-clide-border bg-clide-surface px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30";

  return (
    <div
      className="absolute inset-0 z-40 flex items-start justify-center bg-black/50 pt-16"
      onMouseDown={onClose}
    >
      <div
        className="w-[420px] overflow-hidden rounded-lg border border-clide-border bg-clide-panel shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-clide-border px-5 py-4">
          <span className="text-[14px] font-bold text-white">View settings</span>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-white/60">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
              }}
              className={inputBase}
            />
          </div>

          <div className="flex flex-col gap-1 border-t border-clide-border pt-4">
            <button
              onClick={hide}
              className="flex items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] text-white/70 hover:bg-white/5 hover:text-white"
            >
              <span>Hide tab</span>
              <span className="text-[11px] text-white/30">Unhide from the project toolbar</span>
            </button>

            {confirmingDelete ? (
              <div className="flex items-center justify-between rounded-md bg-red-500/10 px-2.5 py-2">
                <span className="text-[13px] text-red-400">Delete this view?</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-md px-2.5 py-1 text-[12px] text-white/50 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={remove}
                    className="rounded-md bg-red-500/80 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center rounded-md px-2.5 py-2 text-left text-[13px] text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
              >
                Delete view
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
