import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, on } from "../rpc";
import type {
  FilterEntry,
  OutputChunk,
  Project,
  RepeatInterval,
  RunRecord,
  TaskFolder,
  TaskMetaPatch,
  ThreadView,
  Workflow,
} from "../types/tasks";

export interface DraftCard {
  id: string;
  taskSlug: string;
}

/** Which surface the title tab's body shows. Only meaningful when no view tab is active. */
export type ProjectSurface = "thread" | "tasks" | "views" | "calendar" | "files" | "project-settings" | "workflows";

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

  /** What the title tab's body shows (thread / Tasks / Views / Project Settings). */
  projectSurface: ProjectSurface;
  /** Switch the title tab's surface; also activates the title tab. */
  setProjectSurface: (surface: ProjectSurface) => void;

  /** App-level Settings overlay (API keys, Ollama config) — not project-scoped. */
  appSettingsOpen: boolean;
  openAppSettings: () => void;
  closeAppSettings: () => void;

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
  /** Mark a run as read (ticket 97). Optimistically updates local state. */
  markRunRead: (runId: string) => Promise<void>;

  refreshTasks: () => Promise<void>;
  refreshRuns: () => Promise<void>;
}

/**
 * Migrates a `.views.json` view saved under any of the pre-ticket-51 filter
 * shapes (`formSlugs`/`statuses`/`keywords`+`keywordMode`, or the older single
 * `query` string) into the additive `entries` chip list. Lossless: each old
 * field becomes one or more entries, so nothing is silently dropped.
 */
function normalizeView(view: ThreadView): ThreadView {
  const f = view.filters;
  if (f.entries) return view;

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

  return { ...view, filters: entries.length > 0 ? { entries } : {} };
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
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newTaskOpen, setNewFormOpen] = useState(false);
  const [projectSurface, setProjectSurfaceState] = useState<ProjectSurface>("thread");
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [runPickerOpen, setRunPickerOpen] = useState(false);
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

  const [views, setViews] = useState<ThreadView[]>([]);
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
      restoringRef.current = false;
      return;
    }
    let cancelled = false;
    void api.getViews(activeProject).then((loaded) => {
      if (cancelled) return;
      const v = loaded.map(normalizeView);
      setViews(v);
      const want = viewByProjectRef.current[activeProject];
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
    });
  }, [activeProject, activeViewId]);

  const persistViews = useCallback(
    (next: ThreadView[]) => {
      setViews(next);
      if (activeProject) void api.saveViews(activeProject, next);
    },
    [activeProject],
  );

  // Activating a view tab (or returning to the title tab via null) always
  // lands on that tab's thread — surfaces are a title-tab-only concept.
  const setActiveView = useCallback((id: string | null) => {
    setActiveViewId(id);
    setProjectSurfaceState("thread");
    setViewSettingsOpen(false);
  }, []);

  const createView = useCallback(() => {
    if (!activeProject) return;
    const view: ThreadView = {
      id: crypto.randomUUID(),
      name: `View ${views.length + 1}`,
      filters: {},
    };
    persistViews([...views, view]);
    setActiveViewId(view.id);
    setProjectSurfaceState("thread");
  }, [activeProject, views, persistViews]);

  const updateView = useCallback(
    (view: ThreadView) => {
      persistViews(views.map((v) => (v.id === view.id ? view : v)));
    },
    [views, persistViews],
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
    updateView({ ...view, hidden: true });
    setActiveView(prev);
  }, [activeViewId, views, updateView, setActiveView, previousVisibleTab]);

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
    });
    return () => {
      offProjects();
      offTasks();
      offChunk();
      offStatus();
    };
  }, []);

  const tasksBySlug = useMemo(() => {
    const m = new Map<string, TaskFolder>();
    for (const f of tasks) m.set(f.meta.slug, f);
    return m;
  }, [tasks]);

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

  const markRunRead = useCallback(async (runId: string) => {
    const now = new Date().toISOString();
    // Optimistic update
    setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, readAt: now } : r)));
    // Background RPC
    await api.markRunsRead([runId]);
  }, []);

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
    projectSurface,
    setProjectSurface,
    appSettingsOpen,
    openAppSettings,
    closeAppSettings,
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
    profileInterview,
    openProfileInterview,
    closeProfileInterview,
    profileRevision,
    appProfileOffer,
    dismissAppProfileOffer,
    projectProfileOffer,
    dismissProjectProfileOffer,
    views,
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
    markRunRead,
    refreshTasks,
    refreshRuns,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
