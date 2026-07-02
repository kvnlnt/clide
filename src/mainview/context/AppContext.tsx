import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, on } from "../rpc";
import type {
  FormFolder,
  FormMetaPatch,
  OutputChunk,
  Project,
  RepeatInterval,
  RunRecord,
  ThreadView,
} from "../types/forms";

export interface DraftCard {
  id: string;
  formSlug: string;
}

/** Closeable panel tabs that render in the tab strip alongside views. */
export type PanelKind = "forms" | "settings" | "project-settings";

interface AppState {
  forms: FormFolder[];
  formsBySlug: Map<string, FormFolder>;
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
  newFormOpen: boolean;

  /** Panel tabs currently open in the tab strip (order = display order). */
  openPanels: PanelKind[];
  /** The focused panel tab; null means the thread is showing. */
  activePanel: PanelKind | null;
  /** Open (or focus, if already open) a panel tab. */
  openPanel: (kind: PanelKind) => void;
  /** Close a panel tab; falls back to the thread if it was active. */
  closePanel: (kind: PanelKind) => void;
  /** Focus an open panel tab, or null to return to the thread. */
  focusPanel: (kind: PanelKind | null) => void;

  /** Saved thread views for the active project. "All" is implicit (activeViewId === null). */
  views: ThreadView[];
  activeViewId: string | null;
  setActiveView: (id: string | null) => void;
  createView: () => ThreadView | null;
  updateView: (view: ThreadView) => void;
  deleteView: (id: string) => void;
  /** Move the dragged view to the position of the target view (drag-sort). */
  reorderView: (dragId: string, targetId: string) => void;

  setActiveProject: (p: string | null) => void;
  toggleSidebar: () => void;
  openNewProject: () => void;
  closeNewProject: () => void;
  openNewForm: () => void;
  closeNewForm: () => void;

  addFormDraft: (formSlug: string) => void;
  removeDraft: (id: string) => void;

  createProject: (name: string, path?: string) => Promise<{ ok: boolean; error?: string }>;
  renameProject: (path: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  deleteProject: (path: string, deleteFiles?: boolean) => Promise<void>;
  deleteForm: (projectPath: string, slug: string) => Promise<{ ok: boolean; error?: string }>;
  updateFormMeta: (projectPath: string, slug: string, patch: FormMetaPatch) => Promise<{ ok: boolean; error?: string }>;

  submitRun: (formSlug: string, inputs: Record<string, unknown>) => Promise<void>;
  scheduleRun: (
    formSlug: string,
    inputs: Record<string, unknown>,
    scheduledAt: string,
    repeat: RepeatInterval,
  ) => Promise<void>;
  cancelRun: (runId: string) => Promise<void>;
  rerun: (run: RunRecord) => Promise<void>;
  setPinned: (runId: string, pinned: boolean) => Promise<void>;
  deleteRun: (runId: string) => Promise<void>;

  refreshForms: () => Promise<void>;
  refreshRuns: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [forms, setForms] = useState<FormFolder[]>([]);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [chunks, setChunks] = useState<Record<string, OutputChunk[]>>({});
  const [drafts, setDrafts] = useState<DraftCard[]>([]);
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);

  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newFormOpen, setNewFormOpen] = useState(false);
  const [openPanels, setOpenPanels] = useState<PanelKind[]>([]);
  const [activePanel, setActivePanel] = useState<PanelKind | null>(null);

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
    if (!activeProject) {
      setViews([]);
      restoringRef.current = false;
      return;
    }
    let cancelled = false;
    void api.getViews(activeProject).then((v) => {
      if (cancelled) return;
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

  const setActiveView = useCallback((id: string | null) => {
    setActiveViewId(id);
    setActivePanel(null);
  }, []);

  const createView = useCallback((): ThreadView | null => {
    if (!activeProject) return null;
    const view: ThreadView = {
      id: crypto.randomUUID(),
      name: `View ${views.length + 1}`,
      filters: {},
    };
    persistViews([...views, view]);
    setActiveViewId(view.id);
    return view;
  }, [activeProject, views, persistViews]);

  const updateView = useCallback(
    (view: ThreadView) => {
      persistViews(views.map((v) => (v.id === view.id ? view : v)));
    },
    [views, persistViews],
  );

  const deleteView = useCallback(
    (id: string) => {
      persistViews(views.filter((v) => v.id !== id));
      setActiveViewId((cur) => (cur === id ? null : cur));
    },
    [views, persistViews],
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

  const refreshForms = useCallback(async () => {
    const f = await api.listForms();
    setForms(f);
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
      const [projects, ui] = await Promise.all([api.listProjects(), api.getUIState()]);
      setProjectList(projects);
      viewByProjectRef.current = { ...ui.activeViewByProject };
      recentsRef.current = ui.recentProjects;
      setRecentProjects(ui.recentProjects);
      bootedRef.current = true;
    })();
    void refreshForms();
    void refreshRuns();
  }, [refreshForms, refreshRuns]);

  // Push subscriptions.
  useEffect(() => {
    const offProjects = on("projects", (p) => setProjectList(p));
    const offForms = on("forms", (f) => setForms(f));
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
              }
            : r,
        ),
      );
    });
    return () => {
      offProjects();
      offForms();
      offChunk();
      offStatus();
    };
  }, []);

  const formsBySlug = useMemo(() => {
    const m = new Map<string, FormFolder>();
    for (const f of forms) m.set(f.meta.slug, f);
    return m;
  }, [forms]);

  const projects = useMemo(() => {
    const set = new Set<string>(projectList.map((p) => p.name));
    for (const f of forms) {
      if (f.meta.project) set.add(f.meta.project);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [projectList, forms]);

  const toggleSidebar = useCallback(() => setSidebarOpen((s) => !s), []);
  const openPanel = useCallback((kind: PanelKind) => {
    setOpenPanels((prev) => (prev.includes(kind) ? prev : [...prev, kind]));
    setActivePanel(kind);
  }, []);
  const closePanel = useCallback((kind: PanelKind) => {
    setOpenPanels((prev) => prev.filter((k) => k !== kind));
    setActivePanel((cur) => (cur === kind ? null : cur));
  }, []);
  const focusPanel = useCallback((kind: PanelKind | null) => setActivePanel(kind), []);
  const openNewProject = useCallback(() => setNewProjectOpen(true), []);
  const closeNewProject = useCallback(() => setNewProjectOpen(false), []);
  const openNewForm = useCallback(() => {
    closePanel("forms");
    setNewFormOpen(true);
  }, [closePanel]);
  const closeNewForm = useCallback(() => setNewFormOpen(false), []);

  // A project-settings tab has nothing to target without an active project.
  useEffect(() => {
    if (!activeProject) closePanel("project-settings");
  }, [activeProject, closePanel]);

  const removeDraft = useCallback((id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const addFormDraft = useCallback(
    (formSlug: string) => {
      const id = `draft-${draftSeq.current++}`;
      setDrafts((prev) => [{ id, formSlug }, ...prev]);
      setRecentSlugs((prev) => [formSlug, ...prev.filter((s) => s !== formSlug)].slice(0, 5));
      closePanel("forms");
    },
    [closePanel],
  );

  const createProject = useCallback(
    async (name: string, path?: string) => {
      const res = await api.addProject(name, path);
      if (res.ok) {
        await refreshProjects();
        if (res.project) setActiveProject(res.project.name);
      }
      return { ok: res.ok, error: res.error };
    },
    [refreshProjects],
  );

  const renameProject = useCallback(
    async (path: string, name: string) => {
      const res = await api.renameProject(path, name);
      if (res.ok) {
        await refreshProjects();
        await refreshForms();
        if (res.project) {
          setActiveProject((cur) => {
            const old = projectList.find((p) => p.path === path)?.name;
            return cur && cur === old ? res.project!.name : cur;
          });
        }
      }
      return { ok: res.ok, error: res.error };
    },
    [refreshProjects, refreshForms, projectList],
  );

  const deleteProject = useCallback(
    async (path: string, deleteFiles = false) => {
      const removed = projectList.find((p) => p.path === path);
      await api.removeProject(path, deleteFiles);
      await refreshProjects();
      await refreshForms();
      await refreshRuns();
      setActiveProject((cur) => (cur && removed && cur === removed.name ? null : cur));
    },
    [projectList, refreshProjects, refreshForms, refreshRuns],
  );

  const deleteForm = useCallback(
    async (projectPath: string, slug: string) => {
      const res = await api.deleteForm(projectPath, slug);
      if (res.ok) await refreshForms();
      return res;
    },
    [refreshForms],
  );

  const updateFormMeta = useCallback(
    async (projectPath: string, slug: string, patch: FormMetaPatch) => {
      const res = await api.updateFormMeta(projectPath, slug, patch);
      if (res.ok) await refreshForms();
      return res;
    },
    [refreshForms],
  );

  const submitRun = useCallback(async (formSlug: string, inputs: Record<string, unknown>) => {
    const runId = await api.runForm(formSlug, inputs);
    if (!runId) return;
    const optimistic: RunRecord = {
      id: runId,
      formSlug,
      inputs,
      status: "running",
      exitCode: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      outputPath: null,
      pinned: false,
      scheduledAt: null,
      repeatInterval: null,
    };
    setRuns((prev) => [optimistic, ...prev.filter((r) => r.id !== runId)]);
    setRecentSlugs((prev) => [formSlug, ...prev.filter((s) => s !== formSlug)].slice(0, 5));
  }, []);

  const scheduleRun = useCallback(
    async (formSlug: string, inputs: Record<string, unknown>, scheduledAt: string, repeat: RepeatInterval) => {
      await api.scheduleRun(formSlug, inputs, scheduledAt, repeat);
      await refreshRuns();
    },
    [refreshRuns],
  );

  const cancelRun = useCallback(async (runId: string) => {
    await api.cancelRun(runId);
  }, []);

  const rerun = useCallback(
    async (run: RunRecord) => {
      await submitRun(run.formSlug, run.inputs);
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

  const value: AppState = {
    forms,
    formsBySlug,
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
    newFormOpen,
    openPanels,
    activePanel,
    openPanel,
    closePanel,
    focusPanel,
    views,
    activeViewId,
    setActiveView,
    createView,
    updateView,
    deleteView,
    reorderView,
    setActiveProject,
    toggleSidebar,
    openNewProject,
    closeNewProject,
    openNewForm,
    closeNewForm,
    addFormDraft,
    removeDraft,
    createProject,
    renameProject,
    deleteProject,
    deleteForm,
    updateFormMeta,
    submitRun,
    scheduleRun,
    cancelRun,
    rerun,
    setPinned,
    deleteRun,
    refreshForms,
    refreshRuns,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
