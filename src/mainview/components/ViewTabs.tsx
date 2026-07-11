import { Folder, House, Plus } from "lucide-react";
import { useRef } from "react";
import { useApp } from "../context/AppContext";

/**
 * Browser-style tab strip hosted in the window-controls header. The left side
 * is the project projectTab — a Home button and the project title tab — rendered
 * as a filled chip so it reads as a distinct family from the saved views.
 * After a separator come the view tabs: drag-sortable. Activating the title
 * tab or a view tab shows that tab's toolbar + thread as the pane body
 * (ProjectToolbar / ViewToolbar in App.tsx). "+" creates a new view and
 * activates it immediately.
 */
export default function ViewTabs() {
  const { activeProject, setActiveProject, views, activeViewId, setActiveView, reorderView, createView } = useApp();
  const dragIdRef = useRef<string | null>(null);

  const visibleViews = views.filter((v) => !v.hidden);

  // View tabs: browser-style, merging into the content pane when active.
  const tabShape =
    "flex min-w-0 items-center gap-2 rounded-tl-lg rounded-tr-lg px-4 pb-1.5 pt-2 text-sm transition-colors";
  const activeShape = "relative z-10 bg-white/10 bg-clide-bg text-white";
  const inactiveShape = "text-white/30 hover:bg-white/[0.03] hover:text-white";
  const titleTabActive = activeViewId === null;

  return (
    <div className="relative flex min-w-0 flex-1 items-end justify-start gap-1 pl-2 pr-2">
      {activeProject && (
        <>
          <button
            onClick={() => setActiveProject(null)}
            title="Home"
            className="flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <House size={16} />
          </button>

          <button
            onClick={() => setActiveView(null)}
            title={`All ${activeProject} threads`}
            className={`${tabShape} max-w-[200px] ${titleTabActive ? activeShape : inactiveShape}`}
          >
            <Folder size={13} className="shrink-0 opacity-70" />
            <span className="min-w-0 truncate text-left">{activeProject}</span>
          </button>
        </>
      )}

      {visibleViews.map((view) => {
        const isActive = view.id === activeViewId;
        return (
          <div
            key={view.id}
            draggable
            onDragStart={(e) => {
              dragIdRef.current = view.id;
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => {
              dragIdRef.current = null;
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIdRef.current) reorderView(dragIdRef.current, view.id);
              dragIdRef.current = null;
            }}
            // Opted out of the window drag region (electrobun's class-based
            // opt-out) so HTML5 drag-sorting doesn't fight the app-region drag.
            className={`electrobun-webkit-app-region-no-drag group ${tabShape} ${isActive ? activeShape : inactiveShape}`}
          >
            <button
              onClick={() => setActiveView(view.id)}
              title={view.name}
              className="min-w-0 max-w-[120px] truncate text-left group-hover:text-white"
            >
              {view.name}
            </button>
          </div>
        );
      })}

      <button
        disabled={!activeProject}
        onClick={() => createView()}
        title={activeProject ? "New view" : "Select a project to create views"}
        className={`ml-1.5 h-6 w-6 shrink-0 items-center justify-center self-center rounded-full text-white/30 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/30 ${
          activeProject ? "flex" : "hidden"
        }`}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
