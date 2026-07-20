import { useCallback, useEffect, useMemo, useRef } from "react";
import CalendarPage from "./components/CalendarPage";
import { FilesPage } from "./components/files/FilesPage";
import FirstRunAIWizard from "./components/FirstRunAIWizard";
import FirstRunWelcome from "./components/FirstRunWelcome";
import NewProjectModal from "./components/NewProjectModal";
import NewTaskPage from "./components/NewTaskPage";
import ProfileInterviewPage, { ProfileOfferCard } from "./components/ProfileInterviewPage";
import ProjectSettingsPage from "./components/ProjectSettingsPage";
import ProjectToolbar from "./components/ProjectToolbar";
import RunPicker from "./components/RunPicker";
import SettingsPanel from "./components/SettingsPanel";
import Sidebar from "./components/Sidebar";
import SurfaceTransition from "./components/SurfaceTransition";
import TasksPanel from "./components/TasksPanel";
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
    compactMode,
    newProjectOpen,
    newTaskOpen,
    activeProject,
    activeViewId,
    views,
    projects,
    projectSurface,
    setProjectSurface,
    projectMeta,
    closeNewProject,
    closeNewTask,
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
    onboardingActive,
    profileInterview,
    openProfileInterview,
    closeProfileInterview,
    appProfileOffer,
    dismissAppProfileOffer,
    projectProfileOffer,
    dismissProjectProfileOffer,
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
        newTaskOpen ||
        appSettingsOpen ||
        newProjectOpen ||
        viewSettingsOpen ||
        aiWizardOpen ||
        onboardingActive ||
        workflowEditor !== null ||
        profileInterview !== null;
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
      newTaskOpen,
      appSettingsOpen,
      newProjectOpen,
      viewSettingsOpen,
      aiWizardOpen,
      onboardingActive,
      workflowEditor,
      profileInterview,
      activeProject,
      openRunPicker,
      setProjectSurface,
      projectSurface,
      createView,
      closeActiveTab,
      cycleTab,
    ],
  );

  // Native app-menu clicks (View → Tasks/Calendar/…) route through the same dispatcher.
  useEffect(() => on("menuAction", dispatchViewAction), [dispatchViewAction]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // All shortcuts are inert while a blocking overlay is open or no project is active.
      const overlayOpen =
        newTaskOpen ||
        appSettingsOpen ||
        newProjectOpen ||
        viewSettingsOpen ||
        aiWizardOpen ||
        onboardingActive ||
        workflowEditor !== null ||
        profileInterview !== null;
      if (overlayOpen || !activeProject) return;

      // ⌘P Tasks, ⌘⇧C Calendar, ⌘⇧V Views, ⌘⇧U Workflows, ⌘, Settings.
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        const act = (action: string) => {
          e.preventDefault();
          dispatchViewAction(action);
        };
        if (key === "p" && !e.shiftKey) return act("view:tasks");
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
    newTaskOpen,
    appSettingsOpen,
    newProjectOpen,
    viewSettingsOpen,
    aiWizardOpen,
    onboardingActive,
    workflowEditor,
    profileInterview,
    activeProject,
    isMac,
  ]);

  return (
    <div
      className={`relative flex h-screen flex-col overflow-hidden rounded-[15px] border border-white/10 bg-clide-bg text-white p-2.5 ${compactMode ? "clide-compact" : ""}`}
    >
      <header className="flex shrink-0 electrobun-webkit-app-region-drag">
        <WindowControls />
      </header>
      <div className="flex min-h-0 flex-1 text-white">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {onboardingActive || (!activeProject && projects.length === 0) ? (
            <FirstRunWelcome />
          ) : !activeProject ? (
            <WelcomeScreen />
          ) : activeView ? (
            // Ticket 121: view-tab switches fade in — toolbar + thread
            // together, since a different view is a genuinely different page.
            <SurfaceTransition transitionKey={`view:${activeView.id}`} className="flex min-h-0 flex-1 flex-col">
              <ViewToolbar view={activeView} />
              <Thread />
            </SurfaceTransition>
          ) : (
            <>
              <ProjectToolbar />
              {/* Ticket 121: only the swapped body fades — the toolbar above
                  is persistent chrome and shouldn't re-animate on every click. */}
              <SurfaceTransition transitionKey={`surface:${projectSurface}`} className="flex min-h-0 flex-1 flex-col">
                {projectSurface === "tasks" && <TasksPanel />}
                {projectSurface === "views" && <ViewsPage />}
                {projectSurface === "workflows" && <WorkflowsPage />}
                {projectSurface === "calendar" && <CalendarPage />}
                {projectSurface === "files" && (
                  <div className="flex-1 overflow-hidden">
                    <FilesPage projectName={activeProject} scope="project" />
                  </div>
                )}
                {projectSurface === "project-settings" && activeProjectMeta && (
                  <ProjectSettingsPage
                    path={activeProjectMeta.path}
                    name={activeProjectMeta.name}
                    onDone={() => setProjectSurface("thread")}
                  />
                )}
                {projectSurface === "thread" && <Thread />}
              </SurfaceTransition>
            </>
          )}
          {runPickerOpen && activeProject && <RunPicker onClose={closeRunPicker} />}
        </div>
        {sidebarOpen && activeProject !== null && !onboardingActive && <Sidebar />}
      </div>

      {/* Full-window overlay: covers the header/tab strip too, so a minimal
          drag region + traffic lights are re-rendered here to keep the
          window movable/closable while Settings is open. */}
      {appSettingsOpen && (
        <div className="absolute inset-0 z-50 flex flex-col bg-clide-bg clide-takeover-transition">
          <div className="flex electrobun-webkit-app-region-drag">
            <TrafficLights />
          </div>
          <SettingsPanel onClose={closeAppSettings} />
        </div>
      )}

      {/* First-run AI service setup (ticket 76) — same full-window takeover
          mechanic as Settings above, shown whenever zero AI services are registered. */}
      {aiWizardOpen && (
        <div className="absolute inset-0 z-50 flex flex-col bg-clide-bg clide-takeover-transition">
          <div className="flex electrobun-webkit-app-region-drag">
            <TrafficLights />
          </div>
          <FirstRunAIWizard onSkip={dismissAIWizard} onDone={notifyAIServiceAdded} chained={aiWizardChained} />
        </div>
      )}

      {/* Task creation is a focused, modal activity (ticket 67): the wizard
          covers the entire window — tab strip and sidebar included — using
          the same overlay mechanic as Settings above. The workspace stays
          mounted underneath, untouched on close/create. */}
      {newTaskOpen && (
        <div className="absolute inset-0 z-50 flex flex-col bg-clide-bg clide-takeover-transition">
          <div className="flex electrobun-webkit-app-region-drag">
            <TrafficLights />
          </div>
          <NewTaskPage onClose={closeNewTask} />
        </div>
      )}

      {/* NewProjectModal is self-positioned (absolute inset-0); rendering it
          here rather than inside the body pane makes its backdrop dim the
          header/tab strip and sidebar too, not just the body. */}
      {newProjectOpen && <NewProjectModal onClose={closeNewProject} />}

      {/* Workflow creation/editing takes over the whole window like the task
          wizard (tickets 91/92) — same overlay mechanic. */}
      {workflowEditor && (
        <div className="absolute inset-0 z-50 flex flex-col bg-clide-bg clide-takeover-transition">
          <div className="flex electrobun-webkit-app-region-drag">
            <TrafficLights />
          </div>
          {workflowEditor.mode === "new" ? (
            <NewWorkflowWizard onClose={closeWorkflowEditor} />
          ) : (
            <WorkflowEditor
              initial={workflowEditor.workflow}
              onClose={closeWorkflowEditor}
              // forward focusName if the opener requested it
              {...(workflowEditor.focusName ? { focusName: true } : {})}
            />
          )}
        </div>
      )}

      {/* AI profile interview (tickets 100/101) — same takeover mechanic, but
          z-60: it can be launched from inside Settings and must cover it. */}
      {profileInterview && (
        <div className="absolute inset-0 z-[60] flex flex-col bg-clide-bg clide-takeover-transition">
          <div className="flex electrobun-webkit-app-region-drag">
            <TrafficLights />
          </div>
          <ProfileInterviewPage
            scope={profileInterview.scope}
            projectPath={profileInterview.projectPath}
            projectName={profileInterview.projectName}
            onClose={closeProfileInterview}
          />
        </div>
      )}

      {/* Gentle profile-interview offers (tickets 100 §3 / 101 §3) — dismissible
          corner cards, hidden while any takeover is open, never blocking. */}
      {appProfileOffer && !profileInterview && !aiWizardOpen && !appSettingsOpen && !newTaskOpen && !workflowEditor && (
        <ProfileOfferCard
          title="Want CLIDE to know you?"
          body="A two-minute interview builds a profile that makes AI features personal. It stays on this machine."
          onAccept={() => {
            dismissAppProfileOffer();
            openProfileInterview({ scope: "app" });
          }}
          onDismiss={dismissAppProfileOffer}
        />
      )}
      {projectProfileOffer &&
        !appProfileOffer &&
        !profileInterview &&
        !aiWizardOpen &&
        !appSettingsOpen &&
        !newTaskOpen &&
        !workflowEditor && (
          <ProfileOfferCard
            title={`Tell CLIDE about "${projectProfileOffer.name}"`}
            body="A short interview about what this project is for makes its AI features sharper. It stays on this machine."
            onAccept={() => {
              const target = projectProfileOffer;
              dismissProjectProfileOffer();
              openProfileInterview({ scope: "project", projectPath: target.path, projectName: target.name });
            }}
            onDismiss={dismissProjectProfileOffer}
          />
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
