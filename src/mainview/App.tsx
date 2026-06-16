import { useEffect } from "react";
import FormSelector from "./components/FormSelector";
import GridView from "./components/GridView";
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
    closeSettings,
    openSelector,
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
    <div className="flex h-screen bg-clide-bg text-white">
      {sidebarOpen && <Sidebar />}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopBar />
        {viewMode === "list" ? <Thread /> : <GridView />}
        {selectorOpen && <FormSelector />}
        {settingsOpen && <SettingsPanel onClose={closeSettings} />}
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
