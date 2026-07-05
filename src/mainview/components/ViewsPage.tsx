import { Eye, EyeOff, Layers, Trash2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "../context/AppContext";
import type { ThreadView, ThreadViewFilters } from "../types/forms";

function filterSummary(filters: ThreadViewFilters): string {
  const parts: string[] = [];
  if (filters.formSlugs?.length) parts.push(`${filters.formSlugs.length} form${filters.formSlugs.length === 1 ? "" : "s"}`);
  if (filters.statuses?.length) parts.push(`${filters.statuses.length} status${filters.statuses.length === 1 ? "" : "es"}`);
  if (filters.keywords?.length) {
    const mode = filters.keywordMode === "and" ? "all" : "any";
    parts.push(`${filters.keywords.length} keyword${filters.keywords.length === 1 ? "" : "s"} (${mode})`);
  }
  return parts.length > 0 ? parts.join(" · ") : "No filters — shows every run";
}

/**
 * Full-width page listing every saved view (visible and hidden) for the
 * active project: open / hide-show / delete. Replaces the old "Hidden (N)"
 * popover on the project toolbar — unhiding lives here now.
 */
export default function ViewsPage() {
  const { activeProject, views, setActiveView, updateView, deleteView } = useApp();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const open = (view: ThreadView) => {
    if (view.hidden) updateView({ ...view, hidden: false });
    setActiveView(view.id);
  };

  const toggleHidden = (view: ThreadView) => updateView({ ...view, hidden: !view.hidden });

  const remove = (id: string) => {
    deleteView(id);
    setConfirmingId(null);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-baseline gap-2 px-8 pb-4 pt-7">
        <h1 className="text-[20px] font-bold text-white">Views</h1>
        <span className="text-[13px] text-white/40">{activeProject}</span>
      </div>

      <div className="clide-scroll flex-1 overflow-y-auto px-8 pb-8">
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
              <div key={view.id} className="flex items-center gap-3 py-3">
                <button
                  onClick={() => open(view)}
                  className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
                >
                  <span className={`truncate text-[14px] ${view.hidden ? "text-white/40" : "text-white"}`}>
                    {view.name}
                    {view.hidden && <span className="ml-2 text-[11px] font-normal text-white/30">Hidden</span>}
                  </span>
                  <span className="truncate text-[12px] text-white/40">{filterSummary(view.filters)}</span>
                </button>

                <div className="flex shrink-0 items-center gap-1">
                  {confirmingId === view.id ? (
                    <>
                      <span className="mr-1 text-[12px] text-white/50">Delete this view?</span>
                      <button
                        onClick={() => remove(view.id)}
                        className="rounded-md bg-red-500/80 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-red-500"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmingId(null)}
                        className="rounded-md px-2.5 py-1 text-[12px] text-white/50 hover:bg-white/5"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => open(view)}
                        className="rounded-md px-2.5 py-1 text-[12px] font-medium text-white/70 hover:bg-white/5 hover:text-white"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => toggleHidden(view)}
                        title={view.hidden ? "Show tab" : "Hide tab"}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
                      >
                        {view.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button
                        onClick={() => setConfirmingId(view.id)}
                        title="Delete view"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-red-400/70 hover:bg-white/10 hover:text-red-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
