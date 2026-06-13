import { Ellipsis, LayoutGrid, List, ListFilter, PanelLeft, Search } from "lucide-react";
import { useApp } from "../context/AppContext";

export default function TopBar() {
  const { activeProject, toggleSidebar, viewMode, setViewMode, openSelector } = useApp();

  const iconBtn = "text-white/60 transition-colors hover:text-white";

  return (
    <div className="flex h-10 shrink-0 items-center gap-4 border-b border-clide-border px-4">
      <div className="shrink-0 text-[16px] text-white/50">
        {activeProject ? (
          <span>
            {activeProject}
            <span className="px-1.5 text-white/30">›</span>
          </span>
        ) : (
          <span>All Projects</span>
        )}
      </div>

      <button onClick={openSelector} className="flex-1 text-left text-[14px] italic text-white/30 outline-none">
        ✦ At your command...
      </button>

      <div className="flex shrink-0 items-center gap-4">
        <button className={iconBtn} onClick={openSelector} title="Search forms">
          <Search size={20} />
        </button>
        <button className={iconBtn} onClick={toggleSidebar} title="Toggle sidebar">
          <PanelLeft size={20} />
        </button>
        <button
          className={iconBtn}
          onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
          title="Toggle view"
        >
          {viewMode === "list" ? <List size={20} /> : <LayoutGrid size={20} />}
        </button>
        <button className={iconBtn} title="Filter">
          <ListFilter size={20} />
        </button>
        <button className={iconBtn} title="More">
          <Ellipsis size={20} />
        </button>
      </div>
    </div>
  );
}
