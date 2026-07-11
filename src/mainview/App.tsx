import { useEffect, useMemo } from "react";
import CalendarPage from "./components/CalendarPage";
import FormsPanel from "./components/FormsPanel";
import NewFormPage from "./components/NewFormPage";
import NewProjectModal from "./components/NewProjectModal";
import ProjectSettingsPage from "./components/ProjectSettingsPage";
import ProjectToolbar from "./components/ProjectToolbar";
import RunFormPicker from "./components/RunFormPicker";
import SettingsPanel from "./components/SettingsPanel";
import Sidebar from "./components/Sidebar";
import Thread from "./components/Thread";
import TrafficLights from "./components/TrafficLights";
import ViewsPage from "./components/ViewsPage";
import ViewSettingsModal from "./components/ViewSettingsModal";
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
    cycleTab,
    closeActiveTab,
    runPickerOpen,
    openRunPicker,
    closeRunPicker,
    viewSettingsOpen,
    closeViewSettings,
  } = useApp();

  const activeProjectMeta = activeProject ? projectMeta.find((p) => p.name === activeProject) : undefined;
  const activeView = activeViewId ? views.find((v) => v.id === activeViewId) : undefined;

  // navigator.platform is deprecated but userAgent-sniffing "Mac" is still the
  // standard cross-browser way to tell Cmd from Ctrl for shortcut purposes.
  const isMac = useMemo(() => /mac/i.test(navigator.platform || navigator.userAgent), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setProjectSurface("forms");
        return;
      }

      // Browser-style tab navigation is inert while a blocking overlay is open.
      const overlayOpen = newFormOpen || appSettingsOpen || newProjectOpen || viewSettingsOpen;
      if (overlayOpen || !activeProject) return;

      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        cycleTab(e.shiftKey ? -1 : 1);
        return;
      }

      const closeChord = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
      if (closeChord && e.key.toLowerCase() === "w") {
        e.preventDefault();
        closeActiveTab();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openRunPicker();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    setProjectSurface,
    newFormOpen,
    appSettingsOpen,
    newProjectOpen,
    viewSettingsOpen,
    activeProject,
    cycleTab,
    closeActiveTab,
    openRunPicker,
    isMac,
  ]);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden rounded-[15px] border border-white/10 bg-clide-bg text-white p-2.5">
      <header className="flex electrobun-webkit-app-region-drag">
        <WindowControls />
      </header>
      <div className="flex h-screen text-white">
        <div className="relative flex min-w-0 flex-1 flex-col">
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
              {projectSurface === "calendar" && <CalendarPage />}
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
          {runPickerOpen && activeProject && <RunFormPicker onClose={closeRunPicker} />}
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

      {/* Same reasoning as NewProjectModal above — full-window backdrop dim. */}
      {viewSettingsOpen && activeView && (
        <ViewSettingsModal view={activeView} onClose={closeViewSettings} />
      )}
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
