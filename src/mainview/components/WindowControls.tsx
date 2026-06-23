import {
  LayoutGrid,
  List,
  Minus,
  PanelLeft,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { api } from "../rpc";

export default function WindowControls() {
  const {
    toggleSidebar,
    openNewProject,
    activeProject,
    openSelector,
    setViewMode,
    viewMode,
  } = useApp();
  return (
    <div className="window-controls flex gap-1 justify-between w-full placeitems-center transition-colors rounded-[15px] cursor-move">
      <div className="flex p-1.5 gap-2">
        <button
          className="text-black bg-red-600/30 hover:bg-red-600 rounded-full h-4 w-4 flex items-center justify-center transition-colors"
          onClick={api.closeWindow}
        >
          <X size={10} />
        </button>
        <button
          className="text-black bg-yellow-600/30 hover:bg-yellow-600 rounded-full h-4 w-4 flex items-center justify-center transition-colors"
          onClick={api.minimizeWindow}
        >
          <Minus size={10} />
        </button>
      </div>
      <button
        className="flex gap-2 text-white/30 transition-colors hover:text-white flex items-center justify-center rounded-full"
        onClick={openSelector}
      >
        <Search size={15} />
        <span className="text-sm">
          {activeProject ? activeProject : "CLIDE"}
        </span>
      </button>
      <div className="flex p-1.5 gap-3 justify-end">
        <button
          className="text-white/30 transition-colors hover:text-white flex items-center justify-center rounded-full"
          onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
          title="Toggle view"
        >
          {viewMode === "list" ? <List size={18} /> : <LayoutGrid size={18} />}
        </button>
        <button
          onClick={toggleSidebar}
          title="Toggle sidebar"
          className="text-white/30 transition-colors hover:text-white flex items-center justify-center rounded-full"
        >
          <PanelLeft size={18} />
        </button>
        <button
          onClick={openNewProject}
          title="Add project"
          className="text-white/30 transition-colors hover:text-white flex items-center justify-center rounded-full"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}
