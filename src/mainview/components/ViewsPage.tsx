import { Eye, EyeOff, Layers, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "../context/AppContext";
import type { RunStatus, ThreadView, ThreadViewFilters } from "../types/tasks";
import { useUIFeedback } from "./UIFeedback";
import { STATUS_META } from "./statusIcon";

function filterSummary(filters: ThreadViewFilters): string {
  const entries = filters.entries ?? [];
  if (entries.length === 0) return "No filters — shows every run";
  return entries
    .map((entry) => {
      if (entry.type === "task") return `${entry.values.length} task${entry.values.length === 1 ? "" : "s"}`;
      if (entry.type === "status") return entry.values.map((s) => STATUS_META[s as RunStatus].label).join("/");
      return `${entry.values.length} keyword${entry.values.length === 1 ? "" : "s"}`;
    })
    .join(" · ");
}

/**
 * Full-width page listing every saved view (visible and hidden) for the
 * active project: open / hide-show / delete. Replaces the old "Hidden (N)"
 * popover on the project toolbar — unhiding lives here now.
 */
export default function ViewsPage() {
  const { activeProject, views, setActiveView, updateView, deleteView } = useApp();
  const { confirm, toast } = useUIFeedback();
  // Ticket 116: inline rename — click the name to edit it in place.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const open = (view: ThreadView) => {
    if (view.hidden) updateView({ ...view, hidden: false });
    setActiveView(view.id);
  };

  const toggleHidden = (view: ThreadView) => updateView({ ...view, hidden: !view.hidden });

  const startRename = (view: ThreadView) => {
    setEditingId(view.id);
    setEditingName(view.name);
  };

  const commitRename = (view: ThreadView) => {
    const trimmed = editingName.trim();
    setEditingId(null);
    if (!trimmed || trimmed === view.name) return;
    // An actual edit opts the view out of AI auto-naming for good.
    updateView({ ...view, name: trimmed, namedByUser: true });
  };

  const remove = async (view: ThreadView) => {
    const res = await confirm({
      title: `Delete view "${view.name}"?`,
      message: "Its saved filters are gone for good; the runs it showed are untouched.",
      confirmLabel: "Delete",
    });
    if (!res.ok) return;
    deleteView(view.id);
    toast("View deleted");
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-baseline gap-2 px-[var(--clide-page-x)] pb-4 pt-[var(--clide-page-top)]">
        <h1 className="text-[20px] font-bold text-white">Views</h1>
        <span className="text-[13px] text-white/40">{activeProject}</span>
      </div>

      <div className="clide-scroll flex-1 overflow-y-auto px-[var(--clide-page-x)] pb-[var(--clide-page-bottom)]">
        {views.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
              <Layers size={20} className="text-white/40" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[14px] font-medium text-white/70">No saved views yet</span>
              <span className="text-[13px] text-white/40">
                Use the <span className="text-white/60">+</span> button next to the view tabs to create one.
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-white/5 border-t border-white/5">
            {views.map((view) => (
              <div key={view.id} className="flex items-center gap-3 py-[var(--clide-row-y)]">
                <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                  {editingId === view.id ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      onBlur={() => commitRename(view)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(view);
                        else if (e.key === "Escape") setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full min-w-0 rounded border border-clide-border bg-clide-bg px-1.5 py-0.5 text-[14px] text-white outline-none focus:border-white/30"
                    />
                  ) : (
                    <button
                      onClick={() => open(view)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startRename(view);
                      }}
                      title="Double-click to rename"
                      className={`w-full min-w-0 truncate text-left text-[14px] ${view.hidden ? "text-white/40" : "text-white"}`}
                    >
                      {view.name}
                      {view.hidden && <span className="ml-2 text-[11px] font-normal text-white/30">Hidden</span>}
                    </button>
                  )}
                  <button onClick={() => open(view)} className="w-full min-w-0 text-left">
                    <span className="truncate text-[12px] text-white/40">{filterSummary(view.filters)}</span>
                  </button>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => open(view)}
                    className="rounded-md px-2.5 py-1 text-[12px] font-medium text-white/70 hover:bg-white/5 hover:text-white"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => startRename(view)}
                    title="Rename"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => toggleHidden(view)}
                    title={view.hidden ? "Show tab" : "Hide tab"}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
                  >
                    {view.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button
                    onClick={() => void remove(view)}
                    title="Delete view"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-red-400/70 hover:bg-white/10 hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
