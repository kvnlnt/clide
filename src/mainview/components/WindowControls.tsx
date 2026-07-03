import { Minus, PanelLeft, Settings, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { api } from "../rpc";
import ViewTabs from "./ViewTabs";

export default function WindowControls() {
  const { toggleSidebar, openPanel, activeProject } = useApp();
  return (
    <div className="window-controls flex justify-between w-full placeitems-center transition-colors rounded-[15px] cursor-move">
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
      <ViewTabs />
      {activeProject !== null && (
        <div className="flex shrink-0 items-center gap-3 px-1.5">
          <button
            onClick={() => openPanel("settings")}
            title="Settings"
            className="text-white/30 transition-colors hover:text-white flex items-center justify-center rounded-full"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={toggleSidebar}
            title="Toggle sidebar"
            className="text-white/30 transition-colors hover:text-white flex items-center justify-center rounded-full"
          >
            <PanelLeft size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
