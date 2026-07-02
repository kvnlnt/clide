import { useEffect } from "react";
import FormsPanel from "./components/FormsPanel";
import NewFormModal from "./components/NewFormModal";
import NewProjectModal from "./components/NewProjectModal";
import ProjectSettingsModal from "./components/ProjectSettingsModal";
import SettingsPanel from "./components/SettingsPanel";
import Sidebar from "./components/Sidebar";
import Thread from "./components/Thread";
import WelcomeScreen from "./components/WelcomeScreen";
import WindowControls from "./components/WindowControls";
import { AppProvider, useApp } from "./context/AppContext";

function Workspace() {
  const {
    sidebarOpen,
    newProjectOpen,
    newFormOpen,
    activeProject,
    activePanel,
    openPanel,
    closePanel,
    projectMeta,
    closeNewProject,
    closeNewForm,
  } = useApp();

  const activeProjectMeta = activeProject ? projectMeta.find((p) => p.name === activeProject) : undefined;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        openPanel("forms");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openPanel]);

  return (
    <div className="flex h-screen flex-col bg-clide-bg text-white rounded-[15px] p-2.5 border border-white/10">
      <header className="flex electrobun-webkit-app-region-drag">
        <WindowControls />
      </header>
      <div className="flex h-screen text-white">
        <div className="relative flex min-w-0 flex-1 flex-col border-t border-white/10">
          {activePanel === null && (activeProject ? <Thread /> : <WelcomeScreen />)}
          {activePanel === "forms" && <FormsPanel />}
          {activePanel === "settings" && <SettingsPanel onClose={() => closePanel("settings")} />}
          {activePanel === "project-settings" && activeProjectMeta && (
            <ProjectSettingsModal
              path={activeProjectMeta.path}
              name={activeProjectMeta.name}
              onClose={() => closePanel("project-settings")}
            />
          )}
          {newProjectOpen && <NewProjectModal onClose={closeNewProject} />}
          {newFormOpen && <NewFormModal onClose={closeNewForm} />}
        </div>
        {sidebarOpen && activeProject !== null && <Sidebar />}
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
