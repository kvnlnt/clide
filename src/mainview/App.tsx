import { Maximize, Minimize, PanelLeft, X } from "lucide-react";
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
      <header className="h-5 electrobun-webkit-app-region-drag">
        <span className="window-controls electrobun-webkit-app-region-no-drag">
          <button onClick={toggleSidebar} title="Toggle sidebar">
            <PanelLeft size={15} />
          </button>
          <button>
            <Minimize size={15} />
          </button>
          <button>
            <Maximize size={15} />
          </button>
          <button>
            <X size={15} />
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
