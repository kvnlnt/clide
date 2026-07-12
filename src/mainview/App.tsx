import { useCallback, useEffect, useMemo, useRef } from "react";
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
import { UIFeedbackLayer, UIFeedbackProvider } from "./components/UIFeedback";
import { AppProvider, useApp, type ProjectSurface } from "./context/AppContext";
import { on } from "./rpc";

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

  /** Dedupe guard: some platforms deliver both a native menu accelerator and the webview keydown. */
  const lastActionRef = useRef<{ action: string; at: number }>({ action: "", at: 0 });

  // Single dispatcher for surface jumps + run picker, shared by the renderer's
  // keydown handler and the native View menu (which lists these shortcuts).
  const dispatchViewAction = useCallback(
    (action: string) => {
      const overlayOpen = newFormOpen || appSettingsOpen || newProjectOpen || viewSettingsOpen;
      if (overlayOpen || !activeProject) return;
      const now = Date.now();
      if (lastActionRef.current.action === action && now - lastActionRef.current.at < 400) return;
      lastActionRef.current = { action, at: now };

      if (action === "view:run-picker") {
        openRunPicker();
        return;
      }
      // Surface jumps toggle like their toolbar buttons: press again → thread.
      const surface = action.slice("view:".length) as ProjectSurface;
      setProjectSurface(projectSurface === surface ? "thread" : surface);
    },
    [newFormOpen, appSettingsOpen, newProjectOpen, viewSettingsOpen, activeProject, openRunPicker, setProjectSurface, projectSurface],
  );

  // Native app-menu clicks (View → Forms/Calendar/…) route through the same dispatcher.
  useEffect(() => on("menuAction", dispatchViewAction), [dispatchViewAction]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // All shortcuts are inert while a blocking overlay is open or no project is active.
      const overlayOpen = newFormOpen || appSettingsOpen || newProjectOpen || viewSettingsOpen;
      if (overlayOpen || !activeProject) return;

      // ⌘P Forms, ⌘⇧C Calendar, ⌘⇧V Views, ⌘, Settings (plain C/V stay copy/paste).
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        const act = (action: string) => {
          e.preventDefault();
          dispatchViewAction(action);
        };
        if (key === "p" && !e.shiftKey) return act("view:forms");
        if (key === "c" && e.shiftKey) return act("view:calendar");
        if (key === "v" && e.shiftKey) return act("view:views");
        if (key === ",") return act("view:project-settings");
        if (key === "k") return act("view:run-picker");
      }

      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        cycleTab(e.shiftKey ? -1 : 1);
        return;
      }

      const closeChord = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
      if (closeChord && e.key.toLowerCase() === "w") {
        e.preventDefault();
        closeActiveTab();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    dispatchViewAction,
    newFormOpen,
    appSettingsOpen,
    newProjectOpen,
    viewSettingsOpen,
    activeProject,
    cycleTab,
    closeActiveTab,
    isMac,
  ]);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden rounded-[15px] border border-white/10 bg-clide-bg text-white p-2.5">
      <header className="flex electrobun-webkit-app-region-drag">
        <WindowControls />
      </header>
      <div className="flex h-screen text-white">
        <div className="relative flex min-w-0 flex-1 flex-col">
          {!activeProject ? (
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

      {/* Form creation is a focused, modal activity (ticket 67): the wizard
          covers the entire window — tab strip and sidebar included — using
          the same overlay mechanic as Settings above. The workspace stays
          mounted underneath, untouched on close/create. */}
      {newFormOpen && (
        <div className="absolute inset-0 z-50 flex flex-col bg-clide-bg">
          <div className="flex electrobun-webkit-app-region-drag">
            <TrafficLights />
          </div>
          <NewFormPage onClose={closeNewForm} />
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

      {/* Confirm dialogs + toasts, above every overlay (z-100/110). */}
      <UIFeedbackLayer />
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <UIFeedbackProvider>
        <Workspace />
      </UIFeedbackProvider>
    </AppProvider>
  );
}

export default App;
