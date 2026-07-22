import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, on } from "../rpc";
import { matchesView } from "../../shared/viewFilters";
import { blankReport } from "../reportUtils";
import {
  isSpeechRecognitionSupported,
  SPEECH_ACTIVATION_KEYS,
  speak,
  startListening,
  stopSpeaking,
} from "../speech";
import type {
  CalendarViewMode,
  CompanionTranscriptLine,
  FilterEntry,
  OutputChunk,
  Project,
  RepeatInterval,
  Report,
  RunRecord,
  ScheduledWorkflowRun,
  SpeechActivationKey,
  TaskFolder,
  TaskMetaPatch,
  ThreadView,
  ThreadViewFilters,
  Workflow,
} from "../types/tasks";

export interface DraftCard {
  id: string;
  taskSlug: string;
}

/** Which surface the title tab's body shows. Only meaningful when no view tab is active. */
export type ProjectSurface =
  | "thread"
  | "tasks"
  | "views"
  | "calendar"
  | "files"
  | "project-settings"
  | "workflows"
  | "reports";

/** What the profile interview takeover (tickets 100/101) is interviewing about. */
export type ProfileInterviewTarget =
  | { scope: "app"; projectPath?: undefined; projectName?: undefined }
  | { scope: "project"; projectPath: string; projectName: string };

interface AppState {
  tasks: TaskFolder[];
  tasksBySlug: Map<string, TaskFolder>;
  projects: string[];
  projectMeta: Project[];
  runs: RunRecord[];
  chunks: Record<string, OutputChunk[]>;
  drafts: DraftCard[];
  recentSlugs: string[];

  activeProject: string | null;
  /** Project names by recency of activation, most recent first (persisted). */
  recentProjects: string[];
  sidebarOpen: boolean;
  newProjectOpen: boolean;
  newTaskOpen: boolean;
  /** Denser spacing across the main surfaces (ticket 119), persisted. */
  compactMode: boolean;
  setCompactMode: (next: boolean) => void;
  /** Last-used Calendar view (ticket 128), persisted. */
  calendarView: CalendarViewMode;
  setCalendarView: (next: CalendarViewMode) => void;

  /** What the title tab's body shows (thread / Tasks / Views / Project Settings). */
  projectSurface: ProjectSurface;
  /** Switch the title tab's surface; also activates the title tab. */
  setProjectSurface: (surface: ProjectSurface) => void;

  /** App-level Settings overlay (API keys, Ollama config) — not project-scoped. */
  appSettingsOpen: boolean;
  openAppSettings: () => void;
  closeAppSettings: () => void;

  /** Diagnostics takeover (ticket 124), launched from Settings — stacks above it. */
  diagnosticsOpen: boolean;
  openDiagnostics: () => void;
  closeDiagnostics: () => void;

  /** First-run AI service wizard (ticket 76) — full-window takeover shown when zero AI services are registered. */
  aiWizardOpen: boolean;
  /** Quietly dismiss for this launch only; re-evaluated on next boot. */
  dismissAIWizard: () => void;
  /** Wizard finished (a service now exists) — closes the takeover. */
  notifyAIServiceAdded: () => void;
  /** Explicit trigger for callers (e.g. the first-project flow, ticket 78) that need to chain into this step themselves. Pass `true` when it's step 2 of one onboarding flow, so the wizard can say so. */
  openAIWizard: (chained?: boolean) => void;
  /** True while the AI wizard is open *because* the first-project flow just chained into it. */
  aiWizardChained: boolean;

  /** First-run onboarding takeover (ticket 111): true from a zero-project boot until the flow finishes. */
  onboardingActive: boolean;
  completeOnboarding: () => void;

  /** Quick-run task picker (⌘K/Ctrl+K or the toolbar Run button) — drops a draft into the current tab's thread. */
  runPickerOpen: boolean;
  openRunPicker: () => void;
  closeRunPicker: () => void;

  /** Speech mode (ticket 123) — never persisted, always off on boot. Being "active" just arms it; see pressToTalk. */
  speechModeActive: boolean;
  toggleSpeechMode: () => void;
  /** True while a voice-command recognition session is actively listening (mic open). */
  speechListening: boolean;
  /** Last speech error (unsupported env, mic denied, recognition failure) — cleared on the next attempt. */
  speechError: string | null;
  /** Set once a voice command is recognized; RunPicker reads and clears it. */
  pendingSpeechQuery: string | null;
  consumePendingSpeechQuery: () => void;
  /** Push-to-talk (ticket 137): opens one listen session while speech mode is armed, or stops an in-flight one. Also bound to speechActivationKey. */
  pressToTalk: () => void;
  /** Selected speechSynthesis voice (ticket 137), persisted. Undefined = platform default. */
  speechVoiceURI: string | undefined;
  setSpeechVoiceURI: (voiceURI: string | undefined) => void;
  /** Push-to-talk activation key (ticket 137), persisted. */
  speechActivationKey: SpeechActivationKey;
  setSpeechActivationKey: (key: SpeechActivationKey) => void;

  /** Voice companion window (ticket 138) — persisted, defaults to shown/unmuted. */
  companionEnabled: boolean;
  setCompanionEnabled: (enabled: boolean) => void;
  companionMuted: boolean;
  setCompanionMuted: (muted: boolean) => void;

  /** Full-window AI profile interview takeover (tickets 100/101). */
  profileInterview: ProfileInterviewTarget | null;
  openProfileInterview: (target: ProfileInterviewTarget) => void;
  /** saved=true bumps profileRevision so profile-displaying views reload. */
  closeProfileInterview: (saved: boolean) => void;
  /** Bumped whenever an interview saves a profile. */
  profileRevision: number;
  /** Gentle one-time app-profile offer after first-run setup completes (ticket 100 §3). */
  appProfileOffer: boolean;
  dismissAppProfileOffer: () => void;
  /** Post-creation "tell CLIDE about this project" offer (ticket 101 §3). */
  projectProfileOffer: { path: string; name: string } | null;
  dismissProjectProfileOffer: () => void;

  /** Saved thread views for the active project. "All" is implicit (activeViewId === null). */
  views: ThreadView[];
  /** True while the active project's views are being fetched (ticket 121). */
  viewsLoading: boolean;
  activeViewId: string | null;
  setActiveView: (id: string | null) => void;
  updateView: (view: ThreadView) => void;
  deleteView: (id: string) => void;
  /** Move the dragged view to the position of the target view (drag-sort). */
  reorderView: (dragId: string, targetId: string) => void;

  /** Create a new view with a default name, persist it, and activate its tab. */
  createView: () => void;
  /** Browser-style tab cycling: title tab + visible views, in strip order. */
  cycleTab: (delta: 1 | -1) => void;
  /** Cmd+W / Ctrl+W on a view tab: hide it (title tab is not closeable). */
  closeActiveTab: () => void;

  /** Rename/hide/delete modal for the active view tab (ticket 50), launched from its kebab menu. */
  viewSettingsOpen: boolean;
  openViewSettings: () => void;
  closeViewSettings: () => void;

  /** Workflows for the active project (tickets 88-95). */
  workflows: Workflow[];
  refreshWorkflows: () => Promise<void>;
  saveWorkflow: (workflow: Workflow) => Promise<{ ok: boolean; error?: string }>;
  deleteWorkflowById: (id: string) => Promise<void>;
  /** Full-window workflow editor/wizard hosting (tickets 91/92). */
  workflowEditor: { mode: "new" } | { mode: "edit"; workflow: Workflow; focusName?: boolean } | null;
  openWorkflowEditor: (workflow?: Workflow, focusName?: boolean) => void;
  closeWorkflowEditor: () => void;

  /** Reports for the active project (ticket 134). */
  reports: Report[];
  refreshReports: () => Promise<void>;
  saveReport: (report: Report) => Promise<{ ok: boolean; error?: string }>;
  deleteReportById: (id: string) => Promise<void>;
  /** Full-window report builder hosting (ticket 134). "new" still carries a
   *  concrete (blank) Report, generated once at open time, so the editor's
   *  dirty-check against `initial` stays stable across parent re-renders. */
  reportEditor: { mode: "new" | "edit"; report: Report } | null;
  openReportEditor: (report?: Report) => void;
  closeReportEditor: () => void;

  /** Calendar-scheduled workflow runs for the active project (ticket 117). */
  scheduledWorkflows: ScheduledWorkflowRun[];
  scheduleWorkflowRun: (
    workflowId: string,
    workflowName: string,
    params: Record<string, string>,
    scheduledAt: string,
    repeat: RepeatInterval,
  ) => Promise<{ ok: boolean; id?: string; error?: string }>;
  rescheduleWorkflowRun: (id: string, scheduledAt: string, repeat: RepeatInterval) => Promise<void>;
  cancelScheduledWorkflowRun: (id: string) => Promise<void>;
  /** Delete a single occurrence of a recurring scheduled workflow run, leaving the rest of the series intact (ticket 129). */
  deleteScheduledWorkflowOccurrence: (id: string, occurrenceAt: string) => Promise<void>;
  runScheduledWorkflowRunNow: (id: string) => Promise<void>;

  setActiveProject: (p: string | null) => void;
  toggleSidebar: () => void;
  openNewProject: () => void;
  closeNewProject: () => void;
  openNewTask: () => void;
  closeNewTask: () => void;

  addTaskDraft: (taskSlug: string) => void;
  removeDraft: (id: string) => void;

  createProject: (name: string, path?: string) => Promise<{ ok: boolean; error?: string }>;
  renameProject: (path: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  deleteProject: (path: string, deleteFiles?: boolean) => Promise<void>;
  deleteTask: (projectPath: string, slug: string) => Promise<{ ok: boolean; error?: string }>;
  updateTaskMeta: (projectPath: string, slug: string, patch: TaskMetaPatch) => Promise<{ ok: boolean; error?: string }>;

  submitRun: (taskSlug: string, inputs: Record<string, unknown>) => Promise<void>;
  scheduleRun: (
    taskSlug: string,
    inputs: Record<string, unknown>,
    scheduledAt: string,
    repeat: RepeatInterval,
  ) => Promise<void>;
  /** Edit a pending scheduled run's fire time/repeat. */
  updateScheduledRun: (runId: string, scheduledAt: string, repeat: RepeatInterval) => Promise<void>;
  /** Fire a pending scheduled run immediately, bypassing its timer. */
  runScheduledNow: (runId: string) => Promise<void>;
  cancelRun: (runId: string) => Promise<void>;
  rerun: (run: RunRecord) => Promise<void>;
  setPinned: (runId: string, pinned: boolean) => Promise<void>;
  deleteRun: (runId: string) => Promise<void>;
  /** Delete a single occurrence of a recurring scheduled run, leaving the rest of the series intact (ticket 129). */
  deleteOccurrence: (runId: string, occurrenceAt: string) => Promise<void>;
  /** Mark a run as read (ticket 97). Optimistically updates local state. */
  markRunRead: (runId: string) => Promise<void>;
  /** Mark every unread run in a project as read (ticket 126 sidebar "mark all read"). */
  markProjectRunsRead: (projectName: string) => Promise<void>;

  refreshTasks: () => Promise<void>;
  refreshRuns: () => Promise<void>;
}

/**
 * Migrates a `.views.json` view saved under any of the pre-ticket-51 filter
 * shapes (`formSlugs`/`statuses`/`keywords`+`keywordMode`, or the older single
 * `query` string) into the additive `entries` chip list. Lossless: each old
 * field becomes one or more entries, so nothing is silently dropped.
 *
 * Also migrates `namedByUser` (ticket 116): a view predating that field has
 * `undefined` on disk, which is treated as "already named by a person" so
 * upgrading the app never starts silently AI-renaming someone's tabs — every
 * view created going forward writes `namedByUser` explicitly (true or false),
 * so `undefined` can only mean "from before this ticket."
 */
function normalizeView(view: ThreadView): ThreadView {
  const named = view.namedByUser ?? true;
  const f = view.filters;
  if (f.entries) return { ...view, namedByUser: named };

  const entries: FilterEntry[] = [];
  if (f.taskSlugs?.length) entries.push({ id: crypto.randomUUID(), type: "task", values: f.taskSlugs });
  if (f.statuses?.length) entries.push({ id: crypto.randomUUID(), type: "status", values: f.statuses });
  if (f.keywords?.length) {
    if (f.keywordMode === "and") {
      for (const k of f.keywords) entries.push({ id: crypto.randomUUID(), type: "keyword", values: [k] });
    } else {
      entries.push({ id: crypto.randomUUID(), type: "keyword", values: f.keywords });
    }
  } else if (f.query) {
    entries.push({ id: crypto.randomUUID(), type: "keyword", values: [f.query] });
  }

  return { ...view, filters: entries.length > 0 ? { entries } : {}, namedByUser: named };
}

/** Deterministic view name from its filters (ticket 116) — the fallback when AI is unavailable or hasn't answered yet. */
function deterministicViewName(filters: ThreadViewFilters, tasksBySlug: Map<string, TaskFolder>): string {
  const entries = filters.entries ?? [];
  if (entries.length === 0) return "New view";
  const parts = entries.map((e) => {
    if (e.type === "task") {
      const names = e.values.map((slug) => tasksBySlug.get(slug)?.meta.name ?? slug);
      return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ");
    }
    if (e.type === "status") return e.values.join("/");
    return e.values.slice(0, 2).join(" ");
  });
  return parts.join(" · ").slice(0, 40);
}

/** Plain-language filter description for the AI naming prompt (ticket 116). */
function summarizeFiltersForPrompt(filters: ThreadViewFilters, tasksBySlug: Map<string, TaskFolder>): string {
  const entries = filters.entries ?? [];
  if (entries.length === 0) return "No filters.";
  return entries
    .map((e) => {
      if (e.type === "task") {
        const names = e.values.map((slug) => tasksBySlug.get(slug)?.meta.name ?? slug);
        return `Tasks: ${names.join(", ")}`;
      }
      if (e.type === "status") return `Status: ${e.values.join(", ")}`;
      return `Keywords: ${e.values.join(", ")}`;
    })
    .join("; ");
}

/** True when a view has no filter criteria and no explicit user-set name (ticket 115) — nothing to lose deleting it. */
function isViewEmpty(view: ThreadView): boolean {
  return !view.namedByUser && (view.filters.entries?.length ?? 0) === 0;
}

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<TaskFolder[]>([]);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [chunks, setChunks] = useState<Record<string, OutputChunk[]>>({});
  const [drafts, setDrafts] = useState<DraftCard[]>([]);
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);

  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  /** Denser spacing across the main surfaces (ticket 119), persisted in UIState. */
  const [compactMode, setCompactModeState] = useState(false);
  /** Last-used Calendar view (ticket 128), persisted in UIState. */
  const [calendarView, setCalendarViewState] = useState<CalendarViewMode>("month");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newTaskOpen, setNewFormOpen] = useState(false);
  const [projectSurface, setProjectSurfaceState] = useState<ProjectSurface>("thread");
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  /** Full-window Diagnostics takeover (ticket 124), launched from Settings — stacks above it. */
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [runPickerOpen, setRunPickerOpen] = useState(false);
  // Speech mode (ticket 123) — never persisted across restarts, always off on boot.
  const [speechModeActive, setSpeechModeActive] = useState(false);
  const [speechListening, setSpeechListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  /** Set once a voice command is recognized; RunPicker reads and clears it on mount. */
  const [pendingSpeechQuery, setPendingSpeechQuery] = useState<string | null>(null);
  const speechHandleRef = useRef<{ stop: () => void } | null>(null);
  /** Mirrors speechModeActive for the mount-only push-event subscription below. */
  const speechModeActiveRef = useRef(false);
  useEffect(() => {
    speechModeActiveRef.current = speechModeActive;
  }, [speechModeActive]);
  /** Selected synthesis voice (ticket 137), persisted in UIState. */
  const [speechVoiceURI, setSpeechVoiceURIState] = useState<string | undefined>(undefined);
  /** Mirrors speechVoiceURI for the mount-only push-event subscription below. */
  const speechVoiceURIRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    speechVoiceURIRef.current = speechVoiceURI;
  }, [speechVoiceURI]);
  /** Push-to-talk activation key (ticket 137), persisted in UIState. */
  const [speechActivationKey, setSpeechActivationKeyState] = useState<SpeechActivationKey>("l");
  // Voice companion (ticket 138) — the floating window's enabled/muted flags
  // live in bun-side UIState (see uiState.ts), since only bun can create the
  // second BrowserWindow. Mirrored here (and kept live via onCompanionEnabled/
  // MutedChanged pushes, since the companion's own UI can also toggle mute)
  // so Settings and the boot-time greeting can read them synchronously.
  const [companionEnabled, setCompanionEnabledState] = useState(true);
  const [companionMuted, setCompanionMutedState] = useState(false);
  const companionMutedRef = useRef(false);
  useEffect(() => {
    companionMutedRef.current = companionMuted;
  }, [companionMuted]);
  const [viewSettingsOpen, setViewSettingsOpen] = useState(false);
  const [aiWizardOpen, setAiWizardOpen] = useState(false);
  const [aiWizardChained, setAiWizardChained] = useState(false);
  /** Skipped for this launch — don't re-open until the app restarts. */
  const aiWizardSkippedRef = useRef(false);
  const [onboardingActive, setOnboardingActive] = useState(false);
  const [profileInterview, setProfileInterview] = useState<ProfileInterviewTarget | null>(null);
  const [profileRevision, setProfileRevision] = useState(0);
  const [appProfileOffer, setAppProfileOffer] = useState(false);
  /** The app-profile offer is one-shot per launch — never re-raised after any dismissal. */
  const appProfileOfferedRef = useRef(false);
  const [projectProfileOffer, setProjectProfileOffer] = useState<{ path: string; name: string } | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowEditor, setWorkflowEditor] = useState<
    { mode: "new" } | { mode: "edit"; workflow: Workflow; focusName?: boolean } | null
  >(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportEditor, setReportEditor] = useState<{ mode: "new" | "edit"; report: Report } | null>(null);
  /** Calendar-scheduled workflow runs for the active project (ticket 117). */
  const [scheduledWorkflows, setScheduledWorkflows] = useState<ScheduledWorkflowRun[]>([]);

  const [views, setViews] = useState<ThreadView[]>([]);
  /** True while the active project's views are being fetched (ticket 121) — ViewsPage shows a skeleton, not an empty flash. */
  const [viewsLoading, setViewsLoading] = useState(false);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const draftSeq = useRef(0);
  /** Last active view per project — restored on project switch, persisted globally. */
  const viewByProjectRef = useRef<Record<string, string>>({});
  /** Mirror of recentProjects for synchronous persistence. */
  const recentsRef = useRef<string[]>([]);
  /** Guards against persisting UI state before boot restore completes. */
  const bootedRef = useRef(false);
  /** True while a project switch is restoring its saved view (skip persist). */
  const restoringRef = useRef(false);

  // Load the active project's saved views on every project switch, then
  // restore the last active view for that project (title tab otherwise).
  useEffect(() => {
    restoringRef.current = true;
    setActiveViewId(null);
    setProjectSurfaceState("thread");
    if (!activeProject) {
      setViews([]);
      setViewsLoading(false);
      restoringRef.current = false;
      return;
    }
    // Ticket 121: ViewsPage shows a skeleton instead of flashing "No saved
    // views yet" while this is in flight.
    setViewsLoading(true);
    let cancelled = false;
    void api.getViews(activeProject).then((loaded) => {
      if (cancelled) return;
      setViewsLoading(false);
      const normalized = loaded.map(normalizeView);
      const want = viewByProjectRef.current[activeProject];
      // Stale empty views (ticket 115) never accumulate across restarts —
      // except the one about to become active, which gets its usual grace.
      const v = normalized.filter((view) => view.id === want || !isViewEmpty(view));
      setViews(v);
      if (v.length !== normalized.length) void api.saveViews(activeProject, v);
      if (want && v.some((view) => view.id === want && !view.hidden)) {
        setActiveViewId(want);
      }
      restoringRef.current = false;
    });
    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  // Persist UI state (active project, per-project view, project recency) on change.
  useEffect(() => {
    if (!bootedRef.current || restoringRef.current) return;
    if (activeProject) {
      if (activeViewId) viewByProjectRef.current[activeProject] = activeViewId;
      else delete viewByProjectRef.current[activeProject];
      recentsRef.current = [activeProject, ...recentsRef.current.filter((p) => p !== activeProject)].slice(0, 10);
      setRecentProjects(recentsRef.current);
    }
    void api.saveUIState({
      activeProject,
      activeViewByProject: { ...viewByProjectRef.current },
      recentProjects: [...recentsRef.current],
      compactMode,
      calendarView,
      speechVoiceURI,
      speechActivationKey,
    });
  }, [activeProject, activeViewId, compactMode, calendarView, speechVoiceURI, speechActivationKey]);

  const setCompactMode = useCallback((next: boolean) => setCompactModeState(next), []);
  const setCalendarView = useCallback((next: CalendarViewMode) => setCalendarViewState(next), []);
  const setSpeechVoiceURI = useCallback((next: string | undefined) => setSpeechVoiceURIState(next), []);
  const setSpeechActivationKey = useCallback((next: SpeechActivationKey) => setSpeechActivationKeyState(next), []);

  /** Companion window enable/disable and mute (ticket 138) — bun owns the window lifecycle, so these round-trip through it. */
  const setCompanionEnabled = useCallback((next: boolean) => {
    setCompanionEnabledState(next);
    void (next ? api.showCompanion() : api.hideCompanion());
  }, []);
  const setCompanionMuted = useCallback((next: boolean) => {
    setCompanionMutedState(next);
    void api.setCompanionMuted(next);
  }, []);

  const persistViews = useCallback(
    (next: ThreadView[]) => {
      setViews(next);
      if (activeProject) void api.saveViews(activeProject, next);
    },
    [activeProject],
  );

  const tasksBySlug = useMemo(() => {
    const m = new Map<string, TaskFolder>();
    for (const f of tasks) m.set(f.meta.slug, f);
    return m;
  }, [tasks]);

  // Ticket 116: fresh reads inside the debounce timer below, which fires
  // well after the render that scheduled it — state captured in that
  // render's closure would otherwise be stale by the time it runs.
  const viewsRef = useRef<ThreadView[]>([]);
  useEffect(() => {
    viewsRef.current = views;
  }, [views]);
  const runsRef = useRef<RunRecord[]>([]);
  useEffect(() => {
    runsRef.current = runs;
  }, [runs]);
  const namingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    const timers = namingTimersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  /**
   * Ticket 116: refresh an auto-named view's name from its current filters.
   * AI-assisted when a service is configured, deterministic otherwise —
   * either way there's always a name. Re-checks at write time that the view
   * still exists, is still un-named-by-user, and its filters didn't change
   * again while the AI call was in flight (a newer edit always wins).
   */
  const runAutoName = useCallback(
    async (viewId: string) => {
      const view = viewsRef.current.find((v) => v.id === viewId);
      if (!view || view.namedByUser) return;
      const filters = view.filters;
      let name = deterministicViewName(filters, tasksBySlug);
      const sampleRuns = runsRef.current
        .filter((r) => (activeProject ? tasksBySlug.get(r.taskSlug)?.meta.project === activeProject : true))
        .filter((r) => matchesView(r, filters, tasksBySlug))
        .slice(0, 8)
        .map((r) => `${tasksBySlug.get(r.taskSlug)?.meta.name ?? r.taskSlug} — ${r.status}`);
      try {
        const res = await api.suggestViewName(summarizeFiltersForPrompt(filters, tasksBySlug), sampleRuns);
        if (res.ok && res.name) name = res.name;
      } catch {
        /* deterministic name already set */
      }
      const current = viewsRef.current.find((v) => v.id === viewId);
      if (!current || current.namedByUser) return;
      if (JSON.stringify(current.filters) !== JSON.stringify(filters)) return; // superseded by a newer edit
      if (current.name === name) return;
      const next = viewsRef.current.map((v) => (v.id === viewId ? { ...v, name } : v));
      setViews(next);
      if (activeProject) void api.saveViews(activeProject, next);
    },
    [tasksBySlug, activeProject],
  );

  const scheduleAutoName = useCallback(
    (viewId: string) => {
      const timers = namingTimersRef.current;
      const existing = timers.get(viewId);
      if (existing) clearTimeout(existing);
      timers.set(
        viewId,
        setTimeout(() => {
          timers.delete(viewId);
          void runAutoName(viewId);
        }, 900),
      );
    },
    [runAutoName],
  );

  /** Ticket 115: a filterless, unnamed view has nothing to lose — drop it once left. */
  const cleanupIfEmpty = useCallback(
    (id: string) => {
      const view = views.find((v) => v.id === id);
      if (!view || !isViewEmpty(view)) return;
      const next = views.filter((v) => v.id !== id);
      setViews(next);
      if (activeProject) void api.saveViews(activeProject, next);
    },
    [views, activeProject],
  );

  // Activating a view tab (or returning to the title tab via null) always
  // lands on that tab's thread — surfaces are a title-tab-only concept.
  // Leaving an empty tab behind cleans it up (ticket 115) — never while it's
  // still the one being activated (id === activeViewId is a no-op re-click).
  const setActiveView = useCallback(
    (id: string | null) => {
      if (activeViewId !== null && activeViewId !== id) cleanupIfEmpty(activeViewId);
      setActiveViewId(id);
      setProjectSurfaceState("thread");
      setViewSettingsOpen(false);
    },
    [activeViewId, cleanupIfEmpty],
  );

  const createView = useCallback(() => {
    if (!activeProject) return;
    // Ticket 115: opening a new tab abandons the current one — drop it first
    // if it's empty and unnamed, rather than leaving it behind for later.
    const base =
      activeViewId !== null ? views.filter((v) => !(v.id === activeViewId && isViewEmpty(v))) : views;
    // namedByUser: false is explicit (ticket 116) — eligible for auto-naming
    // the moment filters are added, and distinguishes it from a legacy view
    // (undefined) that predates the feature and stays untouched forever.
    const view: ThreadView = {
      id: crypto.randomUUID(),
      name: "New view",
      filters: {},
      namedByUser: false,
    };
    persistViews([...base, view]);
    setActiveViewId(view.id);
    setProjectSurfaceState("thread");
  }, [activeProject, views, activeViewId, persistViews]);

  const updateView = useCallback(
    (view: ThreadView) => {
      const prev = views.find((v) => v.id === view.id);
      persistViews(views.map((v) => (v.id === view.id ? view : v)));
      // Ticket 116: filters changed on an auto-named view → refresh its name.
      if (prev && !view.namedByUser && JSON.stringify(prev.filters) !== JSON.stringify(view.filters)) {
        scheduleAutoName(view.id);
      }
    },
    [views, persistViews, scheduleAutoName],
  );

  /** The visible tab immediately left of `id` (browser-style), or null (title tab) if `id` is leftmost/not visible. */
  const previousVisibleTab = useCallback(
    (id: string): string | null => {
      const visible = views.filter((v) => !v.hidden);
      const idx = visible.findIndex((v) => v.id === id);
      return idx > 0 ? visible[idx - 1]!.id : null;
    },
    [views],
  );

  const deleteView = useCallback(
    (id: string) => {
      const wasActive = activeViewId === id;
      const nextActive = wasActive ? previousVisibleTab(id) : null;
      persistViews(views.filter((v) => v.id !== id));
      if (wasActive) setActiveViewId(nextActive);
    },
    [views, activeViewId, persistViews, previousVisibleTab],
  );

  const reorderView = useCallback(
    (dragId: string, targetId: string) => {
      if (dragId === targetId) return;
      const from = views.findIndex((v) => v.id === dragId);
      const to = views.findIndex((v) => v.id === targetId);
      if (from === -1 || to === -1) return;
      const next = [...views];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      persistViews(next);
    },
    [views, persistViews],
  );

  const cycleTab = useCallback(
    (delta: 1 | -1) => {
      if (!activeProject) return;
      const tabs: (string | null)[] = [null, ...views.filter((v) => !v.hidden).map((v) => v.id)];
      const from = activeViewId === null ? 0 : tabs.indexOf(activeViewId);
      const next = ((from === -1 ? 0 : from) + delta + tabs.length) % tabs.length;
      setActiveView(tabs[next]);
    },
    [activeProject, views, activeViewId, setActiveView],
  );

  const closeActiveTab = useCallback(() => {
    if (!activeViewId) return;
    const view = views.find((v) => v.id === activeViewId);
    if (!view) return;
    const prev = previousVisibleTab(activeViewId);
    // Ticket 115: a filterless, unnamed view has nothing worth hiding —
    // delete outright instead of leaving a phantom hidden entry behind.
    if (isViewEmpty(view)) {
      persistViews(views.filter((v) => v.id !== activeViewId));
    } else {
      updateView({ ...view, hidden: true });
    }
    setActiveViewId(prev);
    setProjectSurfaceState("thread");
    setViewSettingsOpen(false);
  }, [activeViewId, views, updateView, persistViews, previousVisibleTab]);

  const refreshTasks = useCallback(async () => {
    const f = await api.listTasks();
    setTasks(f);
  }, []);

  const refreshProjects = useCallback(async () => {
    const p = await api.listProjects();
    setProjectList(p);
  }, []);

  const refreshRuns = useCallback(async () => {
    const r = await api.getAllRuns(null);
    setRuns(r);
  }, []);

  // Initial load. Restores persisted view/recency state once the project list
  // is known. The active project is intentionally NOT restored — the app
  // always launches on the welcome screen.
  useEffect(() => {
    void (async () => {
      const [projects, ui, aiServices] = await Promise.all([
        api.listProjects(),
        api.getUIState(),
        api.listAIServices(),
      ]);
      setProjectList(projects);
      viewByProjectRef.current = { ...ui.activeViewByProject };
      recentsRef.current = ui.recentProjects;
      setRecentProjects(ui.recentProjects);
      setCompactModeState(ui.compactMode === true);
      setCalendarViewState(ui.calendarView ?? "month");
      setSpeechVoiceURIState(ui.speechVoiceURI);
      setSpeechActivationKeyState(ui.speechActivationKey ?? "l");
      setCompanionEnabledState(ui.companionEnabled !== false);
      setCompanionMutedState(ui.companionMuted === true);
      bootedRef.current = true;
      // Zero projects = the onboarding flow (ticket 111) owns the whole
      // first-run sequence, including AI setup, until it completes.
      if (projects.length === 0) setOnboardingActive(true);
      // Existing users with projects but no AI service (ticket 76).
      else if (aiServices.length === 0) setAiWizardOpen(true);
    })();
    void refreshTasks();
    void refreshRuns();
  }, [refreshTasks, refreshRuns]);

  /**
   * Voice companion talk-back (ticket 138): always relays a transcript line
   * (so muted still reads as text), and speaks it too unless muted. Ticket
   * 123's push-to-talk speech mode narrates instead when it's already on,
   * so the two features never talk over each other.
   */
  const speakToCompanion = useCallback((text: string, kind: NonNullable<CompanionTranscriptLine["kind"]>) => {
    void api.relayCompanionTranscriptLine({
      id: crypto.randomUUID(),
      role: "clide",
      text,
      timestamp: new Date().toISOString(),
      kind,
    });
    if (!companionMutedRef.current && !speechModeActiveRef.current) {
      speak(text, speechVoiceURIRef.current, (phase, charIndex) =>
        void api.relayCompanionSpeechPhase({ phase, charIndex }),
      );
    }
  }, []);

  // Voice companion boot greeting (ticket 138): asks bun to show the window
  // (when enabled) and greet exactly once per app launch.
  useEffect(() => {
    void api.initCompanion().then(({ shouldGreet, greeting }) => {
      if (shouldGreet && greeting) speakToCompanion(greeting, "greeting");
    });
  }, [speakToCompanion]);

  // Push subscriptions.
  useEffect(() => {
    const offProjects = on("projects", (p) => setProjectList(p));
    const offTasks = on("tasks", (f) => setTasks(f));
    const offChunk = on("chunk", (chunk: OutputChunk) => {
      setChunks((prev) => ({
        ...prev,
        [chunk.runId]: [...(prev[chunk.runId] ?? []), chunk],
      }));
    });
    const offStatus = on("status", (update) => {
      setRuns((prev) =>
        prev.map((r) =>
          r.id === update.runId
            ? {
                ...r,
                status: update.status,
                exitCode: update.exitCode,
                finishedAt: update.finishedAt,
                ...(update.summary !== undefined ? { summary: update.summary } : {}),
              }
            : r,
        ),
      );
      // Voice out (ticket 123): speak the ticket-98 run summary as it streams
      // in, while speech mode is on. Read the live ref, not the closed-over
      // state — this subscription is set up once on mount.
      if (speechModeActiveRef.current && update.summary) speak(update.summary, speechVoiceURIRef.current);
      // Voice companion (ticket 138): the same summary narrated/transcribed
      // through the companion window, errors called out distinctly.
      if (update.summary) speakToCompanion(update.summary, update.status === "error" ? "error" : "summary");
    });
    const offCompanionEnabled = on("companionEnabled", (enabled) => setCompanionEnabledState(enabled));
    const offCompanionMuted = on("companionMuted", (muted) => setCompanionMutedState(muted));
    return () => {
      offProjects();
      offTasks();
      offChunk();
      offStatus();
      offCompanionEnabled();
      offCompanionMuted();
    };
  }, [speakToCompanion]);

  const projects = useMemo(() => {
    const set = new Set<string>(projectList.map((p) => p.name));
    for (const f of tasks) {
      if (f.meta.project) set.add(f.meta.project);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [projectList, tasks]);

  const toggleSidebar = useCallback(() => setSidebarOpen((s) => !s), []);
  // Switching surfaces always means "on the title tab" — clear any active view.
  const setProjectSurface = useCallback((surface: ProjectSurface) => {
    setActiveViewId(null);
    setProjectSurfaceState(surface);
  }, []);
  const openAppSettings = useCallback(() => setAppSettingsOpen(true), []);
  const closeAppSettings = useCallback(() => setAppSettingsOpen(false), []);
  const openDiagnostics = useCallback(() => setDiagnosticsOpen(true), []);
  const closeDiagnostics = useCallback(() => setDiagnosticsOpen(false), []);
  const dismissAIWizard = useCallback(() => {
    aiWizardSkippedRef.current = true;
    setAiWizardOpen(false);
  }, []);
  const notifyAIServiceAdded = useCallback(() => {
    setAiWizardOpen(false);
    // First-run setup just completed — offer the profile interview once,
    // never forced (ticket 100 §3). Only when no profile exists yet.
    if (!appProfileOfferedRef.current) {
      void api.getUserProfile().then((profile) => {
        if (!profile && !appProfileOfferedRef.current) {
          appProfileOfferedRef.current = true;
          setAppProfileOffer(true);
        }
      });
    }
  }, []);
  const openAIWizard = useCallback((chained = false) => {
    if (aiWizardSkippedRef.current) return;
    setAiWizardChained(chained);
    setAiWizardOpen(true);
  }, []);
  const completeOnboarding = useCallback(() => setOnboardingActive(false), []);
  const openRunPicker = useCallback(() => setRunPickerOpen(true), []);
  const closeRunPicker = useCallback(() => setRunPickerOpen(false), []);

  /** One listen-for-a-command session — result opens the ⌘K picker pre-filled (ticket 123). */
  const listenOnce = useCallback(() => {
    if (!isSpeechRecognitionSupported()) return;
    setSpeechError(null);
    setSpeechListening(true);
    speechHandleRef.current = startListening(
      (transcript) => {
        setPendingSpeechQuery(transcript);
        setRunPickerOpen(true);
        void api.relayCompanionTranscriptLine({
          id: crypto.randomUUID(),
          role: "user",
          text: transcript,
          timestamp: new Date().toISOString(),
          kind: "heard",
        });
      },
      (message) => setSpeechError(message),
      () => {
        setSpeechListening(false);
        speechHandleRef.current = null;
      },
    );
  }, []);

  const toggleSpeechMode = useCallback(() => {
    setSpeechModeActive((active) => {
      const next = !active;
      if (!next) {
        // Turning off: stop mid-listen and cut voice out immediately.
        speechHandleRef.current?.stop();
        stopSpeaking();
        setSpeechListening(false);
        setSpeechError(null);
      }
      // Turning on only arms speech mode (ticket 137) — the mic stays closed
      // until a push-to-talk key press, preventing accidental activation.
      return next;
    });
  }, []);

  /** Mirrors speechModeActive/speechListening for the mount-only keydown listener below. */
  const speechListeningRef = useRef(false);
  useEffect(() => {
    speechListeningRef.current = speechListening;
  }, [speechListening]);

  // Voice companion (ticket 138): "listens for a response through the
  // ticket-123/137 speech pipeline" — the mic itself stays owned by the main
  // window (see listenOnce above); this just relays the open/closed state so
  // the companion's face can show a listening ring.
  useEffect(() => {
    void api.relayCompanionListening(speechListening);
  }, [speechListening]);

  /** Push-to-talk (ticket 137): key press opens one listen session while armed, or stops an in-flight one early. */
  const pressToTalk = useCallback(() => {
    if (!speechModeActiveRef.current) return;
    if (speechListeningRef.current) {
      speechHandleRef.current?.stop();
      return;
    }
    listenOnce();
  }, [listenOnce]);

  const consumePendingSpeechQuery = useCallback(() => {
    setPendingSpeechQuery(null);
  }, []);

  // Ticket 123: stop everything on unmount — never leave the mic hot.
  useEffect(() => {
    return () => {
      speechHandleRef.current?.stop();
      stopSpeaking();
    };
  }, []);

  // Ticket 137: global push-to-talk activation key, chorded with Cmd/Ctrl+Shift
  // (see App.tsx's onKeyDown for the same modifier-chord convention). Reads
  // the current overlay-open state via refs so this one mount-only listener
  // stays inert while any blocking overlay is open, matching the guard used
  // by every other app-wide shortcut.
  const activeProjectRef = useRef<string | null>(null);
  useEffect(() => {
    activeProjectRef.current = activeProject;
  }, [activeProject]);
  const overlayOpenRef = useRef(false);
  useEffect(() => {
    overlayOpenRef.current =
      newTaskOpen ||
      appSettingsOpen ||
      diagnosticsOpen ||
      newProjectOpen ||
      viewSettingsOpen ||
      aiWizardOpen ||
      onboardingActive ||
      workflowEditor !== null ||
      reportEditor !== null ||
      profileInterview !== null;
  });
  const speechActivationKeyRef = useRef<SpeechActivationKey>("l");
  useEffect(() => {
    speechActivationKeyRef.current = speechActivationKey;
  }, [speechActivationKey]);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (overlayOpenRef.current || !activeProjectRef.current) return;
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      const preset = SPEECH_ACTIVATION_KEYS.find((k) => k.value === speechActivationKeyRef.current);
      if (!preset || e.key.toLowerCase() !== preset.eventKey) return;
      e.preventDefault();
      pressToTalk();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pressToTalk]);
  const openProfileInterview = useCallback((target: ProfileInterviewTarget) => setProfileInterview(target), []);
  const closeProfileInterview = useCallback((saved: boolean) => {
    setProfileInterview(null);
    if (saved) setProfileRevision((r) => r + 1);
  }, []);
  const dismissAppProfileOffer = useCallback(() => setAppProfileOffer(false), []);
  const dismissProjectProfileOffer = useCallback(() => setProjectProfileOffer(null), []);
  const openViewSettings = useCallback(() => setViewSettingsOpen(true), []);
  const closeViewSettings = useCallback(() => setViewSettingsOpen(false), []);

  const refreshWorkflows = useCallback(async () => {
    if (!activeProject) {
      setWorkflows([]);
      return;
    }
    setWorkflows(await api.listWorkflows(activeProject));
  }, [activeProject]);

  const saveWorkflow = useCallback(
    async (workflow: Workflow) => {
      if (!activeProject) return { ok: false, error: "No active project" };
      const res = await api.saveWorkflow(activeProject, workflow);
      if (res.ok) await refreshWorkflows();
      return res;
    },
    [activeProject, refreshWorkflows],
  );

  const deleteWorkflowById = useCallback(
    async (id: string) => {
      if (!activeProject) return;
      await api.deleteWorkflow(activeProject, id);
      await refreshWorkflows();
    },
    [activeProject, refreshWorkflows],
  );

  const openWorkflowEditor = useCallback((workflow?: Workflow, focusName?: boolean) => {
    setWorkflowEditor(workflow ? { mode: "edit", workflow, focusName } : { mode: "new" });
  }, []);
  const closeWorkflowEditor = useCallback(() => setWorkflowEditor(null), []);

  // Workflows load with the project (like views).
  useEffect(() => {
    void refreshWorkflows();
  }, [refreshWorkflows]);

  const refreshReports = useCallback(async () => {
    if (!activeProject) {
      setReports([]);
      return;
    }
    setReports(await api.listReports(activeProject));
  }, [activeProject]);

  const saveReport = useCallback(
    async (report: Report) => {
      if (!activeProject) return { ok: false, error: "No active project" };
      const res = await api.saveReport(activeProject, report);
      if (res.ok) await refreshReports();
      return res;
    },
    [activeProject, refreshReports],
  );

  const deleteReportById = useCallback(
    async (id: string) => {
      if (!activeProject) return;
      await api.deleteReport(activeProject, id);
      await refreshReports();
    },
    [activeProject, refreshReports],
  );

  const openReportEditor = useCallback((report?: Report) => {
    setReportEditor(report ? { mode: "edit", report } : { mode: "new", report: blankReport() });
  }, []);
  const closeReportEditor = useCallback(() => setReportEditor(null), []);

  // Reports load with the project (like workflows/views).
  useEffect(() => {
    void refreshReports();
  }, [refreshReports]);

  const refreshScheduledWorkflows = useCallback(async () => {
    if (!activeProject) {
      setScheduledWorkflows([]);
      return;
    }
    setScheduledWorkflows(await api.getScheduledWorkflows(activeProject));
  }, [activeProject]);

  useEffect(() => {
    void refreshScheduledWorkflows();
  }, [refreshScheduledWorkflows]);

  const scheduleWorkflowRun = useCallback(
    async (
      workflowId: string,
      workflowName: string,
      params: Record<string, string>,
      scheduledAt: string,
      repeat: RepeatInterval,
    ) => {
      if (!activeProject) return { ok: false, error: "No active project" };
      const res = await api.scheduleWorkflowRun(activeProject, workflowId, workflowName, params, scheduledAt, repeat);
      if (res.ok) await refreshScheduledWorkflows();
      return res;
    },
    [activeProject, refreshScheduledWorkflows],
  );

  const rescheduleWorkflowRun = useCallback(
    async (id: string, scheduledAt: string, repeat: RepeatInterval) => {
      if (!activeProject) return;
      await api.rescheduleWorkflowRun(activeProject, id, scheduledAt, repeat);
      await refreshScheduledWorkflows();
    },
    [activeProject, refreshScheduledWorkflows],
  );

  const cancelScheduledWorkflowRun = useCallback(
    async (id: string) => {
      if (!activeProject) return;
      await api.cancelScheduledWorkflowRun(activeProject, id);
      await refreshScheduledWorkflows();
    },
    [activeProject, refreshScheduledWorkflows],
  );

  const deleteScheduledWorkflowOccurrence = useCallback(
    async (id: string, occurrenceAt: string) => {
      if (!activeProject) return;
      await api.deleteScheduledWorkflowOccurrence(activeProject, id, occurrenceAt);
      await refreshScheduledWorkflows();
    },
    [activeProject, refreshScheduledWorkflows],
  );

  const runScheduledWorkflowRunNow = useCallback(
    async (id: string) => {
      if (!activeProject) return;
      await api.runScheduledWorkflowRunNow(activeProject, id);
      await refreshScheduledWorkflows();
    },
    [activeProject, refreshScheduledWorkflows],
  );
  const openNewProject = useCallback(() => setNewProjectOpen(true), []);
  const closeNewProject = useCallback(() => setNewProjectOpen(false), []);
  const openNewTask = useCallback(() => {
    setProjectSurfaceState("thread");
    setNewFormOpen(true);
  }, []);
  const closeNewTask = useCallback(() => setNewFormOpen(false), []);

  const removeDraft = useCallback((id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const addTaskDraft = useCallback((taskSlug: string) => {
    const id = `draft-${draftSeq.current++}`;
    setDrafts((prev) => [{ id, taskSlug }, ...prev]);
    setRecentSlugs((prev) => [taskSlug, ...prev.filter((s) => s !== taskSlug)].slice(0, 5));
    setProjectSurfaceState("thread");
  }, []);

  const createProject = useCallback(
    async (name: string, path?: string) => {
      const wasFirstProject = projectList.length === 0;
      const res = await api.addProject(name, path);
      if (res.ok) {
        await refreshProjects();
        if (res.project) {
          setActiveProject(res.project.name);
          // Offer the project interview (ticket 101 §3) — dismissible, never
          // blocks the thread. The very first project skips it: the first-run
          // chain (AI wizard → app-profile offer) owns that onboarding moment.
          if (!wasFirstProject) setProjectProfileOffer({ path: res.project.path, name: res.project.name });
        }
      }
      return { ok: res.ok, error: res.error };
    },
    [refreshProjects, projectList],
  );

  const renameProject = useCallback(
    async (path: string, name: string) => {
      const res = await api.renameProject(path, name);
      if (res.ok) {
        await refreshProjects();
        await refreshTasks();
        if (res.project) {
          setActiveProject((cur) => {
            const old = projectList.find((p) => p.path === path)?.name;
            return cur && cur === old ? res.project!.name : cur;
          });
        }
      }
      return { ok: res.ok, error: res.error };
    },
    [refreshProjects, refreshTasks, projectList],
  );

  const deleteProject = useCallback(
    async (path: string, deleteFiles = false) => {
      const removed = projectList.find((p) => p.path === path);
      await api.removeProject(path, deleteFiles);
      await refreshProjects();
      await refreshTasks();
      await refreshRuns();
      setActiveProject((cur) => (cur && removed && cur === removed.name ? null : cur));
    },
    [projectList, refreshProjects, refreshTasks, refreshRuns],
  );

  const deleteTask = useCallback(
    async (projectPath: string, slug: string) => {
      const res = await api.deleteTask(projectPath, slug);
      if (res.ok) await refreshTasks();
      return res;
    },
    [refreshTasks],
  );

  const updateTaskMeta = useCallback(
    async (projectPath: string, slug: string, patch: TaskMetaPatch) => {
      const res = await api.updateTaskMeta(projectPath, slug, patch);
      if (res.ok) await refreshTasks();
      return res;
    },
    [refreshTasks],
  );

  const submitRun = useCallback(
    async (taskSlug: string, inputs: Record<string, unknown>) => {
      const runId = await api.runTask(taskSlug, inputs);
      if (!runId) return;
      const optimistic: RunRecord = {
        id: runId,
        taskSlug,
        inputs,
        status: "running",
        exitCode: null,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        outputPath: null,
        pinned: false,
        scheduledAt: null,
        repeatInterval: null,
        skipDates: [],
        readAt: null,
        taskVersion: tasksBySlug.get(taskSlug)?.meta.version ?? 1,
      };
      setRuns((prev) => [optimistic, ...prev.filter((r) => r.id !== runId)]);
      setRecentSlugs((prev) => [taskSlug, ...prev.filter((s) => s !== taskSlug)].slice(0, 5));
    },
    [tasksBySlug],
  );

  const scheduleRun = useCallback(
    async (taskSlug: string, inputs: Record<string, unknown>, scheduledAt: string, repeat: RepeatInterval) => {
      await api.scheduleRun(taskSlug, inputs, scheduledAt, repeat);
      await refreshRuns();
    },
    [refreshRuns],
  );

  const updateScheduledRun = useCallback(
    async (runId: string, scheduledAt: string, repeat: RepeatInterval) => {
      await api.updateScheduledRun(runId, scheduledAt, repeat);
      await refreshRuns();
    },
    [refreshRuns],
  );

  const runScheduledNow = useCallback(
    async (runId: string) => {
      await api.runScheduledNow(runId);
      await refreshRuns();
    },
    [refreshRuns],
  );

  const cancelRun = useCallback(async (runId: string) => {
    await api.cancelRun(runId);
  }, []);

  const rerun = useCallback(
    async (run: RunRecord) => {
      await submitRun(run.taskSlug, run.inputs);
    },
    [submitRun],
  );

  const setPinned = useCallback(async (runId: string, pinned: boolean) => {
    await api.setPinned(runId, pinned);
    setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, pinned } : r)));
  }, []);

  const deleteRun = useCallback(async (runId: string) => {
    await api.deleteRun(runId);
    setRuns((prev) => prev.filter((r) => r.id !== runId));
  }, []);

  const deleteOccurrence = useCallback(
    async (runId: string, occurrenceAt: string) => {
      await api.deleteOccurrence(runId, occurrenceAt);
      await refreshRuns();
    },
    [refreshRuns],
  );

  const markRunRead = useCallback(async (runId: string) => {
    const now = new Date().toISOString();
    // Optimistic update
    setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, readAt: now } : r)));
    // Background RPC
    await api.markRunsRead([runId]);
  }, []);

  const markProjectRunsRead = useCallback(
    async (projectName: string) => {
      const unreadIds = runsRef.current
        .filter(
          (r) =>
            (r.status === "success" || r.status === "error") &&
            !r.readAt &&
            tasksBySlug.get(r.taskSlug)?.meta.project === projectName,
        )
        .map((r) => r.id);
      if (unreadIds.length === 0) return;
      const now = new Date().toISOString();
      const idSet = new Set(unreadIds);
      setRuns((prev) => prev.map((r) => (idSet.has(r.id) ? { ...r, readAt: now } : r)));
      await api.markRunsRead(unreadIds);
    },
    [tasksBySlug],
  );

  const value: AppState = {
    tasks,
    tasksBySlug,
    projects,
    projectMeta: projectList,
    runs,
    chunks,
    drafts,
    recentSlugs,
    activeProject,
    recentProjects,
    sidebarOpen,
    newProjectOpen,
    newTaskOpen,
    compactMode,
    setCompactMode,
    calendarView,
    setCalendarView,
    projectSurface,
    setProjectSurface,
    appSettingsOpen,
    openAppSettings,
    closeAppSettings,
    diagnosticsOpen,
    openDiagnostics,
    closeDiagnostics,
    aiWizardOpen,
    dismissAIWizard,
    notifyAIServiceAdded,
    openAIWizard,
    aiWizardChained,
    onboardingActive,
    completeOnboarding,
    runPickerOpen,
    openRunPicker,
    closeRunPicker,
    speechModeActive,
    toggleSpeechMode,
    speechListening,
    speechError,
    pendingSpeechQuery,
    consumePendingSpeechQuery,
    pressToTalk,
    speechVoiceURI,
    setSpeechVoiceURI,
    speechActivationKey,
    setSpeechActivationKey,
    companionEnabled,
    setCompanionEnabled,
    companionMuted,
    setCompanionMuted,
    profileInterview,
    openProfileInterview,
    closeProfileInterview,
    profileRevision,
    appProfileOffer,
    dismissAppProfileOffer,
    projectProfileOffer,
    dismissProjectProfileOffer,
    views,
    viewsLoading,
    activeViewId,
    setActiveView,
    updateView,
    deleteView,
    reorderView,
    createView,
    cycleTab,
    closeActiveTab,
    viewSettingsOpen,
    openViewSettings,
    closeViewSettings,
    workflows,
    refreshWorkflows,
    saveWorkflow,
    deleteWorkflowById,
    workflowEditor,
    openWorkflowEditor,
    closeWorkflowEditor,
    reports,
    refreshReports,
    saveReport,
    deleteReportById,
    reportEditor,
    openReportEditor,
    closeReportEditor,
    scheduledWorkflows,
    scheduleWorkflowRun,
    rescheduleWorkflowRun,
    cancelScheduledWorkflowRun,
    deleteScheduledWorkflowOccurrence,
    runScheduledWorkflowRunNow,
    setActiveProject,
    toggleSidebar,
    openNewProject,
    closeNewProject,
    openNewTask,
    closeNewTask,
    addTaskDraft,
    removeDraft,
    createProject,
    renameProject,
    deleteProject,
    deleteTask,
    updateTaskMeta,
    submitRun,
    scheduleRun,
    updateScheduledRun,
    runScheduledNow,
    cancelRun,
    rerun,
    setPinned,
    deleteRun,
    deleteOccurrence,
    markRunRead,
    markProjectRunsRead,
    refreshTasks,
    refreshRuns,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
