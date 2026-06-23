import { useEffect } from "react";
import FormSelector from "./components/FormSelector";
import GridView from "./components/GridView";
import NewProjectModal from "./components/NewProjectModal";
import SettingsPanel from "./components/SettingsPanel";
import Sidebar from "./components/Sidebar";
import Thread from "./components/Thread";
import WindowControls from "./components/WindowControls";
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
    <div className="flex h-screen flex-col bg-clide-bg text-white rounded-[15px] p-2.5 gap-2.5 border border-white/10">
      <header className="flex electrobun-webkit-app-region-drag">
        <WindowControls />
      </header>
      <div className="flex h-screen text-white">
        <div className="relative flex min-w-0 flex-1 flex-col">
          {viewMode === "list" ? <Thread /> : <GridView />}
          {selectorOpen && <FormSelector />}
          {settingsOpen && <SettingsPanel onClose={closeSettings} />}
          {newProjectOpen && <NewProjectModal onClose={closeNewProject} />}
        </div>
        {sidebarOpen && <Sidebar />}
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
