import { Minus, PanelLeft, X } from "lucide-react";
import { useEffect } from "react";
import FormSelector from "./components/FormSelector";
import GridView from "./components/GridView";
import NewProjectModal from "./components/NewProjectModal";
import SettingsPanel from "./components/SettingsPanel";
import Sidebar from "./components/Sidebar";
import Thread from "./components/Thread";
import TopBar from "./components/TopBar";
import { AppProvider, useApp } from "./context/AppContext";

function Workspace() {
  const {
    sidebarOpen,
    viewMode,
    selectorOpen,
    settingsOpen,
    newProjectOpen,
    closeSettings,
    closeNewProject,
    openSelector,
    toggleSidebar,
  } = useApp();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        openSelector();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSelector]);

  return (
    <div className="flex h-screen flex-col bg-clide-bg text-white rounded-[15px]">
      <header className="flex electrobun-webkit-app-region-drag px-3 pt-3">
        <span className="window-controls electrobun-webkit-app-region-no-drag flex gap-1">
          <button className="text-white/30 transition-colors hover:text-white" onClick={() => window.close()}>
            <X size={15} />
          </button>
          <button className="text-white/30 transition-colors hover:text-white" onClick={() => window.minimize()}>
            <Minus size={15} />
          </button>

          <button
            onClick={toggleSidebar}
            title="Toggle sidebar"
            className="text-white/30 transition-colors hover:text-white"
          >
            <PanelLeft size={15} />
          </button>
        </span>
      </header>
      <div className="flex h-screen text-white">
        {sidebarOpen && <Sidebar />}

        <div className="relative flex min-w-0 flex-1 flex-col">
          <TopBar />
          {viewMode === "list" ? <Thread /> : <GridView />}
          {selectorOpen && <FormSelector />}
          {settingsOpen && <SettingsPanel onClose={closeSettings} />}
          {newProjectOpen && <NewProjectModal onClose={closeNewProject} />}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <Workspace />
    </AppProvider>
  );
}

export default App;
