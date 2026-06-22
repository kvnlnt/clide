import { LayoutGrid, List, Search } from "lucide-react";
import { useApp } from "../context/AppContext";

export default function TopBar() {
  const { activeProject, viewMode, setViewMode, openSelector } = useApp();

  const iconBtn =
    "text-white/60 transition-colors hover:text-white flex items-center gap-2";

  return (
    <div className="flex h-10 justify-between gap-4 border-b border-clide-border px-4">
      <div className="flex items-center gap-2">
        <button onClick={openSelector} className={iconBtn}>
          <Search size={16} />
          <div className="shrink-0 text-[16px] text-white/50">
            {activeProject ? (
              <span>{activeProject}</span>
            ) : (
              <span>All Projects</span>
            )}
          </div>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-4">
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
