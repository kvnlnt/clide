import { useEffect } from "react";
import FormsPanel from "./components/FormsPanel";
import NewFormPage from "./components/NewFormPage";
import NewProjectModal from "./components/NewProjectModal";
import ProjectSettingsPage from "./components/ProjectSettingsPage";
import ProjectToolbar from "./components/ProjectToolbar";
import SettingsPanel from "./components/SettingsPanel";
import Sidebar from "./components/Sidebar";
import Thread from "./components/Thread";
import TrafficLights from "./components/TrafficLights";
import ViewsPage from "./components/ViewsPage";
import ViewToolbar from "./components/ViewToolbar";
import WelcomeScreen from "./components/WelcomeScreen";
import WindowControls from "./components/WindowControls";
import { AppProvider, useApp } from "./context/AppContext";

function Workspace() {
  const {
    sidebarOpen,
    newProjectOpen,
    newFormOpen,
    activeProject,
    activeViewId,
    views,
    projectSurface,
    setProjectSurface,
    projectMeta,
    closeNewProject,
    closeNewForm,
    appSettingsOpen,
    closeAppSettings,
  } = useApp();

  const activeProjectMeta = activeProject ? projectMeta.find((p) => p.name === activeProject) : undefined;
  const activeView = activeViewId ? views.find((v) => v.id === activeViewId) : undefined;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setProjectSurface("forms");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setProjectSurface]);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden rounded-[15px] border border-white/10 bg-clide-bg text-white p-2.5">
      <header className="flex electrobun-webkit-app-region-drag">
        <WindowControls />
      </header>
      <div className="flex h-screen text-white">
        <div className="relative flex min-w-0 flex-1 flex-col border-t border-white/10">
          {newFormOpen ? (
            <NewFormPage onClose={closeNewForm} />
          ) : !activeProject ? (
            <WelcomeScreen />
          ) : activeView ? (
            <>
              <ViewToolbar view={activeView} />
              <Thread />
            </>
          ) : (
            <>
              <ProjectToolbar />
              {projectSurface === "forms" && <FormsPanel />}
              {projectSurface === "views" && <ViewsPage />}
              {projectSurface === "project-settings" && activeProjectMeta && (
                <ProjectSettingsPage
                  path={activeProjectMeta.path}
                  name={activeProjectMeta.name}
                  onDone={() => setProjectSurface("thread")}
                />
              )}
              {projectSurface === "thread" && <Thread />}
            </>
          )}
        </div>
        {sidebarOpen && activeProject !== null && <Sidebar />}
      </div>

      {/* Full-window overlay: covers the header/tab strip too, so a minimal
          drag region + traffic lights are re-rendered here to keep the
          window movable/closable while Settings is open. */}
      {appSettingsOpen && (
        <div className="absolute inset-0 z-50 flex flex-col bg-clide-bg">
          <div className="flex electrobun-webkit-app-region-drag">
            <TrafficLights />
          </div>
          <SettingsPanel onClose={closeAppSettings} />
        </div>
      )}

      {/* NewProjectModal is self-positioned (absolute inset-0); rendering it
          here rather than inside the body pane makes its backdrop dim the
          header/tab strip and sidebar too, not just the body. */}
      {newProjectOpen && <NewProjectModal onClose={closeNewProject} />}
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
