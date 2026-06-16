import { LayoutGrid, List, PanelLeft, Sparkles } from "lucide-react";
import { useApp } from "../context/AppContext";

export default function TopBar() {
  const { activeProject, toggleSidebar, viewMode, setViewMode, openSelector } =
    useApp();

  const iconBtn = "text-white/60 transition-colors hover:text-white";

  return (
    <div className="flex h-10 justify-between gap-4 border-b border-clide-border px-4">
      <div className="flex items-center gap-4">
        <button
          className={iconBtn}
          onClick={toggleSidebar}
          title="Toggle sidebar"
        >
          <PanelLeft size={20} />
        </button>
        <div className="shrink-0 text-[16px] text-white/50">
          {activeProject ? (
            <span>{activeProject}</span>
          ) : (
            <span>All Projects</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <button onClick={openSelector} className={iconBtn}>
          <Sparkles size={16} />
        </button>
        <button
          className={iconBtn}
          onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
          title="Toggle view"
        >
          {viewMode === "list" ? <List size={20} /> : <LayoutGrid size={20} />}
        </button>
      </div>
    </div>
  );
}
