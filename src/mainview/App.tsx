import { useCallback, useEffect, useMemo, useRef } from "react";
import CalendarPage from "./components/CalendarPage";
import FirstRunAIWizard from "./components/FirstRunAIWizard";
import FirstRunWelcome from "./components/FirstRunWelcome";
import FormsPanel from "./components/FormsPanel";
import NewFormPage from "./components/NewFormPage";
import NewProjectModal from "./components/NewProjectModal";
import ProjectSettingsPage from "./components/ProjectSettingsPage";
import ProjectToolbar from "./components/ProjectToolbar";
import RunPicker from "./components/RunPicker";
import SettingsPanel from "./components/SettingsPanel";
import Sidebar from "./components/Sidebar";
import Thread from "./components/Thread";
import TrafficLights from "./components/TrafficLights";
import { UIFeedbackLayer, UIFeedbackProvider } from "./components/UIFeedback";
import ViewSettingsModal from "./components/ViewSettingsModal";
import ViewsPage from "./components/ViewsPage";
import ViewToolbar from "./components/ViewToolbar";
import WelcomeScreen from "./components/WelcomeScreen";
import WindowControls from "./components/WindowControls";
import NewWorkflowWizard from "./components/workflow/NewWorkflowWizard";
import WorkflowEditor from "./components/workflow/WorkflowEditor";
import WorkflowsPage from "./components/workflow/WorkflowsPage";
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
    projects,
    projectSurface,
    setProjectSurface,
    projectMeta,
    closeNewProject,
    closeNewForm,
    appSettingsOpen,
    closeAppSettings,
    aiWizardOpen,
    aiWizardChained,
    dismissAIWizard,
    notifyAIServiceAdded,
    cycleTab,
    closeActiveTab,
    createView,
    runPickerOpen,
    openRunPicker,
    closeRunPicker,
    viewSettingsOpen,
    closeViewSettings,
    workflowEditor,
    closeWorkflowEditor,
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
      const overlayOpen =
        newFormOpen || appSettingsOpen || newProjectOpen || viewSettingsOpen || aiWizardOpen || workflowEditor !== null;
      if (overlayOpen || !activeProject) return;
      const now = Date.now();
      if (lastActionRef.current.action === action && now - lastActionRef.current.at < 400) return;
      lastActionRef.current = { action, at: now };

      if (action === "view:run-picker") {
        openRunPicker();
        return;
      }
      if (action === "view:new-tab") {
        createView();
        return;
      }
      if (action === "view:close-tab") {
        closeActiveTab();
        return;
      }
      if (action === "view:next-tab") {
        cycleTab(1);
        return;
      }
      if (action === "view:prev-tab") {
        cycleTab(-1);
        return;
      }
      // Surface jumps toggle like their toolbar buttons: press again → thread.
      const surface = action.slice("view:".length) as ProjectSurface;
      setProjectSurface(projectSurface === surface ? "thread" : surface);
    },
    [
      newFormOpen,
      appSettingsOpen,
      newProjectOpen,
      viewSettingsOpen,
      aiWizardOpen,
      workflowEditor,
      activeProject,
      openRunPicker,
      setProjectSurface,
      projectSurface,
      createView,
      closeActiveTab,
      cycleTab,
    ],
  );

  // Native app-menu clicks (View → Forms/Calendar/…) route through the same dispatcher.
  useEffect(() => on("menuAction", dispatchViewAction), [dispatchViewAction]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // All shortcuts are inert while a blocking overlay is open or no project is active.
      const overlayOpen =
        newFormOpen || appSettingsOpen || newProjectOpen || viewSettingsOpen || aiWizardOpen || workflowEditor !== null;
      if (overlayOpen || !activeProject) return;

      // ⌘P Forms, ⌘⇧C Calendar, ⌘⇧V Views, ⌘⇧U Workflows, ⌘, Settings.
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        const act = (action: string) => {
          e.preventDefault();
          dispatchViewAction(action);
        };
        if (key === "p" && !e.shiftKey) return act("view:forms");
        if (key === "c" && e.shiftKey) return act("view:calendar");
        if (key === "v" && e.shiftKey) return act("view:views");
        if (key === "u" && e.shiftKey) return act("view:workflows");
        if (key === ",") return act("view:project-settings");
        if (key === "k") return act("view:run-picker");
      }

      // Ctrl+Tab / Ctrl+Shift+Tab: browser-style tab cycling (same on every platform).
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        dispatchViewAction(e.shiftKey ? "view:prev-tab" : "view:next-tab");
        return;
      }

      // ⌘W / Ctrl+W close tab, ⌘T / Ctrl+T new tab — the browser convention (ticket 43, 83).
      const closeChord = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
      if (closeChord && e.key.toLowerCase() === "w") {
        e.preventDefault();
        dispatchViewAction("view:close-tab");
        return;
      }
      if (closeChord && e.key.toLowerCase() === "t") {
        e.preventDefault();
        dispatchViewAction("view:new-tab");
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
    aiWizardOpen,
    workflowEditor,
    activeProject,
    isMac,
  ]);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden rounded-[15px] border border-white/10 bg-clide-bg text-white p-2.5">
      <header className="flex shrink-0 electrobun-webkit-app-region-drag">
        <WindowControls />
      </header>
      <div className="flex min-h-0 flex-1 text-white">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {!activeProject ? (
            projects.length === 0 ? (
              <FirstRunWelcome />
            ) : (
              <WelcomeScreen />
            )
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
              {projectSurface === "workflows" && <WorkflowsPage />}
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
          {runPickerOpen && activeProject && <RunPicker onClose={closeRunPicker} />}
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

      {/* First-run AI service setup (ticket 76) — same full-window takeover
          mechanic as Settings above, shown whenever zero AI services are registered. */}
      {aiWizardOpen && (
        <div className="absolute inset-0 z-50 flex flex-col bg-clide-bg">
          <div className="flex electrobun-webkit-app-region-drag">
            <TrafficLights />
          </div>
          <FirstRunAIWizard onSkip={dismissAIWizard} onDone={notifyAIServiceAdded} chained={aiWizardChained} />
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

      {/* Workflow creation/editing takes over the whole window like the form
          wizard (tickets 91/92) — same overlay mechanic. */}
      {workflowEditor && (
        <div className="absolute inset-0 z-50 flex flex-col bg-clide-bg">
          <div className="flex electrobun-webkit-app-region-drag">
            <TrafficLights />
          </div>
          {workflowEditor.mode === "new" ? (
            <NewWorkflowWizard onClose={closeWorkflowEditor} />
          ) : (
            <WorkflowEditor initial={workflowEditor.workflow} onClose={closeWorkflowEditor} />
          )}
        </div>
      )}

      {/* Same reasoning as NewProjectModal above — full-window backdrop dim. */}
      {viewSettingsOpen && activeView && <ViewSettingsModal view={activeView} onClose={closeViewSettings} />}

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
