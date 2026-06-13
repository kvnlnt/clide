import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, on } from "../rpc";
import type { FormFolder, OutputChunk, Project, RepeatInterval, RunRecord } from "../types/forms";

export type ViewMode = "list" | "grid";

export interface DraftCard {
  id: string;
  kind: "form" | "new-form";
  formSlug?: string;
}

interface AppState {
  forms: FormFolder[];
  formsBySlug: Map<string, FormFolder>;
  projects: string[];
  runs: RunRecord[];
  chunks: Record<string, OutputChunk[]>;
  drafts: DraftCard[];
  recentSlugs: string[];

  activeProject: string | null;
  sidebarOpen: boolean;
  viewMode: ViewMode;
  selectorOpen: boolean;

  setActiveProject: (p: string | null) => void;
  toggleSidebar: () => void;
  setViewMode: (m: ViewMode) => void;
  openSelector: () => void;
  closeSelector: () => void;

  addFormDraft: (formSlug: string) => void;
  addNewFormDraft: () => void;
  removeDraft: (id: string) => void;

  createProject: (name: string, path?: string) => Promise<{ ok: boolean; error?: string }>;

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectorOpen, setSelectorOpen] = useState(false);

  const draftSeq = useRef(0);

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

  // Initial load.
  useEffect(() => {
    void refreshProjects();
    void refreshForms();
    void refreshRuns();
  }, [refreshProjects, refreshForms, refreshRuns]);

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
  const openSelector = useCallback(() => setSelectorOpen(true), []);
  const closeSelector = useCallback(() => setSelectorOpen(false), []);

  const removeDraft = useCallback((id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const addFormDraft = useCallback((formSlug: string) => {
    const id = `draft-${draftSeq.current++}`;
    setDrafts((prev) => [{ id, kind: "form", formSlug }, ...prev]);
    setRecentSlugs((prev) => [formSlug, ...prev.filter((s) => s !== formSlug)].slice(0, 5));
    setSelectorOpen(false);
  }, []);

  const addNewFormDraft = useCallback(() => {
    const id = `draft-${draftSeq.current++}`;
    setDrafts((prev) => [{ id, kind: "new-form" }, ...prev]);
    setSelectorOpen(false);
  }, []);

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
    runs,
    chunks,
    drafts,
    recentSlugs,
    activeProject,
    sidebarOpen,
    viewMode,
    selectorOpen,
    setActiveProject,
    toggleSidebar,
    setViewMode,
    openSelector,
    closeSelector,
    addFormDraft,
    addNewFormDraft,
    removeDraft,
    createProject,
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
