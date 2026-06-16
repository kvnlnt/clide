import FormSelector from "./components/FormSelector";
import GridView from "./components/GridView";
import SettingsPanel from "./components/SettingsPanel";
import Sidebar from "./components/Sidebar";
import Thread from "./components/Thread";
import TopBar from "./components/TopBar";
import { AppProvider, useApp } from "./context/AppContext";

function Workspace() {
  const { sidebarOpen, viewMode, selectorOpen, settingsOpen, closeSettings } = useApp();

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
