import { PanelLeft, Settings2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import TrafficLights from "./TrafficLights";
import ViewTabs from "./ViewTabs";

export default function WindowControls() {
  const { toggleSidebar, openAppSettings, activeProject } = useApp();
  return (
    <div className="window-controls flex justify-between w-full placeitems-center transition-colors rounded-[15px] cursor-move">
      <TrafficLights />
      <ViewTabs />
      {activeProject !== null && (
        <div className="flex shrink-0 items-center gap-3 px-1.5">
          <button
            onClick={openAppSettings}
            title="Settings"
            className="text-white/30 transition-colors hover:text-white flex items-center justify-center rounded-full"
          >
            <Settings2 size={18} />
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
