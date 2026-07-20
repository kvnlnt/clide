import { Electroview } from "electrobun/view";
import type {
  AIService,
  ClideRPC,
  CommandSpec,
  InterviewTurn,
  OutputChunk,
  OutputDefinition,
  OutputResult,
  OutputType,
  ProfileAmendment,
  ProfileScope,
  ProfileSection,
  Project,
  ProjectLayout,
  ProjectProfile,
  RepeatInterval,
  RunRecord,
  RunStatusUpdate,
  StarterTask,
  TaskField,
  TaskFolder,
  TaskMetaPatch,
  ThreadView,
  ToolRegistryEntry,
  ToolSource,
  ToolSpec,
  UIState,
  UserProfile,
  Workflow,
  WorkflowPlanEntry,
  WorkflowRun,
  WorkflowRunSummary,
  WorkflowStepRecord,
} from "../shared/types";

// ---------------------------------------------------------------------------
// Event bus for push messages from the Bun main process.
// ---------------------------------------------------------------------------
type EventMap = {
  projects: Project[];
  tasks: TaskFolder[];
  chunk: OutputChunk;
  status: RunStatusUpdate;
  /** Native app-menu action id, e.g. "view:tasks". */
  menuAction: string;
  /** Live workflow-run state (full record) on every step transition. */
  workflowRun: WorkflowRun;
};

type Listener<K extends keyof EventMap> = (payload: EventMap[K]) => void;

const listeners: { [K in keyof EventMap]: Set<Listener<K>> } = {
  projects: new Set(),
  tasks: new Set(),
  chunk: new Set(),
  status: new Set(),
  menuAction: new Set(),
  workflowRun: new Set(),
};

function emit<K extends keyof EventMap>(key: K, payload: EventMap[K]): void {
  for (const l of listeners[key]) l(payload);
}

export function on<K extends keyof EventMap>(key: K, listener: Listener<K>): () => void {
  listeners[key].add(listener);
  return () => listeners[key].delete(listener);
}

// ---------------------------------------------------------------------------
// Electroview RPC setup.
// ---------------------------------------------------------------------------
const rpcDef = Electroview.defineRPC<ClideRPC>({
  maxRequestTime: 60000,
  handlers: {
    requests: {},
    messages: {
      onProjectsChanged: ({ projects }) => emit("projects", projects),
      onTasksChanged: ({ tasks }) => emit("tasks", tasks),
      onOutputChunk: (chunk) => emit("chunk", chunk),
      onRunStatus: (update) => emit("status", update),
      onMenuAction: ({ action }) => emit("menuAction", action),
      onWorkflowRunUpdate: ({ run }) => emit("workflowRun", run),
    },
  },
});

let electroview: Electroview<typeof rpcDef> | null = null;
try {
  electroview = new Electroview({ rpc: rpcDef });
} catch (err) {
  console.warn("[rpc] Electroview unavailable (running outside Electrobun?)", err);
}

/**
 * Client-side cap on interview RPCs (ticket 108): a hung bridge or provider
 * must land in the page's error/retry state, never an infinitely pending
 * promise. Generous — drafting a whole profile is the slowest AI call here.
 */
const INTERVIEW_TIMEOUT_MS = 90_000;

function interviewTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("The AI request timed out — the service may be slow or unreachable.")),
      INTERVIEW_TIMEOUT_MS,
    );
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function request(): typeof rpcDef.request | null {
  return electroview?.rpc?.request ?? null;
}

function send(): typeof rpcDef.send | null {
  return electroview?.rpc?.send ?? null;
}

// ---------------------------------------------------------------------------
// Typed client API. Each method degrades gracefully when the native bridge is
// unavailable (e.g. when the view is opened in a plain browser tab).
// ---------------------------------------------------------------------------
export const api = {
  async closeWindow(): Promise<void> {
    const r = request();
    if (!r) return;
    try {
      await r.closeWindow(null);
    } catch {
      return;
    }
  },

  async minimizeWindow(): Promise<void> {
    const r = request();
    if (!r) return;
    try {
      await r.minimizeWindow(null);
    } catch {
      return;
    }
  },

  async listProjects(): Promise<Project[]> {
    const r = request();
    if (!r) return [];
    try {
      return await r.listProjects({});
    } catch {
      return [];
    }
  },

  async addProject(name: string, path?: string): Promise<{ ok: boolean; project?: Project; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.addProject({ name, path });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async renameProject(path: string, name: string): Promise<{ ok: boolean; project?: Project; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.renameProject({ path, name });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async removeProject(path: string, deleteFiles = false): Promise<void> {
    await request()?.removeProject({ path, deleteFiles });
  },

  async getTrackUnread(path: string): Promise<boolean> {
    const r = request();
    if (!r) return true; // Default to tracking
    try {
      return await r.getTrackUnread({ path });
    } catch {
      return true;
    }
  },

  async setTrackUnread(path: string, trackUnread: boolean): Promise<void> {
    await request()?.setTrackUnread({ path, trackUnread });
  },

  async listTasks(): Promise<TaskFolder[]> {
    const r = request();
    if (!r) return [];
    try {
      return await r.listTasks({});
    } catch {
      return [];
    }
  },

  async getAllRuns(project: string | null): Promise<RunRecord[]> {
    const r = request();
    if (!r) return [];
    try {
      return await r.getAllRuns({ project });
    } catch {
      return [];
    }
  },

  async getRunHistory(taskSlug: string, limit: number): Promise<RunRecord[]> {
    const r = request();
    if (!r) return [];
    try {
      return await r.getRunHistory({ taskSlug, limit });
    } catch {
      return [];
    }
  },

  async runTask(taskSlug: string, inputs: Record<string, unknown>): Promise<string | null> {
    const r = request();
    if (!r) return null;
    try {
      const { runId } = await r.runTask({ taskSlug, inputs });
      return runId;
    } catch {
      return null;
    }
  },

  async cancelRun(runId: string): Promise<void> {
    await request()?.cancelRun({ runId });
  },

  async readOutputFile(runId: string): Promise<{ mime: string; base64: string } | null> {
    const r = request();
    if (!r) return null;
    try {
      return await r.readOutputFile({ runId });
    } catch {
      return null;
    }
  },

  async getTaskScript(taskSlug: string): Promise<{ script: string; extension: string } | null> {
    const r = request();
    if (!r) return null;
    try {
      return await r.getTaskScript({ taskSlug });
    } catch {
      return null;
    }
  },

  async saveServiceCredential(serviceId: string, key: string): Promise<void> {
    await request()?.saveServiceCredential({ serviceId, key });
  },

  async hasServiceCredential(serviceId: string): Promise<boolean> {
    const r = request();
    if (!r) return false;
    try {
      return await r.hasServiceCredential({ serviceId });
    } catch {
      return false;
    }
  },

  async listAIServices(): Promise<AIService[]> {
    const r = request();
    if (!r) return [];
    try {
      return await r.listAIServices({});
    } catch {
      return [];
    }
  },

  async saveAIServices(services: AIService[]): Promise<void> {
    await request()?.saveAIServices({ services });
  },

  async testAIService(serviceId: string): Promise<{ ok: boolean; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.testAIService({ serviceId });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async fillMagicFields(
    taskSlug: string,
    fields: Record<string, string>,
  ): Promise<{ ok: boolean; values?: Record<string, unknown>; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.fillMagicFields({ taskSlug, fields });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  // Profiles (tickets 100/101) ------------------------------------------------

  async getUserProfile(): Promise<UserProfile | null> {
    const r = request();
    if (!r) return null;
    try {
      return await r.getUserProfile({});
    } catch {
      return null;
    }
  },

  async saveUserProfile(profile: UserProfile): Promise<{ ok: boolean; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.saveUserProfile({ profile });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async deleteUserProfile(): Promise<void> {
    await request()?.deleteUserProfile({});
  },

  async getProjectProfile(projectPath: string): Promise<ProjectProfile | null> {
    const r = request();
    if (!r) return null;
    try {
      return await r.getProjectProfile({ projectPath });
    } catch {
      return null;
    }
  },

  async saveProjectProfile(projectPath: string, profile: ProjectProfile): Promise<{ ok: boolean; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.saveProjectProfile({ projectPath, profile });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async deleteProjectProfile(projectPath: string): Promise<void> {
    await request()?.deleteProjectProfile({ projectPath });
  },

  async profileInterviewNext(
    scope: ProfileScope,
    projectPath: string | undefined,
    transcript: InterviewTurn[],
    ai?: { serviceId: string; model: string },
  ): Promise<{ ok: boolean; question?: string; category?: string; done?: boolean; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await interviewTimeout(r.profileInterviewNext({ scope, projectPath, transcript, ...ai }));
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async profileInterviewFinish(
    scope: ProfileScope,
    projectPath: string | undefined,
    transcript: InterviewTurn[],
    ai?: { serviceId: string; model: string },
  ): Promise<{
    ok: boolean;
    sections?: ProfileSection[];
    selfNotes?: string;
    suggestAppInterview?: boolean;
    error?: string;
  }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await interviewTimeout(r.profileInterviewFinish({ scope, projectPath, transcript, ...ai }));
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async profileReflect(
    scope: ProfileScope,
    projectPath?: string,
  ): Promise<{ ok: boolean; amendments?: ProfileAmendment[]; appAmendments?: ProfileAmendment[]; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.profileReflect({ scope, projectPath });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async recordProfileRejection(scope: ProfileScope, projectPath: string | undefined, note: string): Promise<void> {
    await request()?.recordProfileRejection({ scope, projectPath, note });
  },

  async setPinned(runId: string, pinned: boolean): Promise<void> {
    await request()?.setPinned({ runId, pinned });
  },

  async deleteRun(runId: string): Promise<void> {
    await request()?.deleteRun({ runId });
  },

  async markRunsRead(runIds: string[]): Promise<void> {
    if (runIds.length === 0) return;
    await request()?.markRunsRead({ runIds });
  },

  async markWorkflowRunsRead(project: string, runIds: string[]): Promise<void> {
    if (runIds.length === 0) return;
    await request()?.markWorkflowRunsRead({ project, runIds });
  },

  async scheduleRun(
    taskSlug: string,
    inputs: Record<string, unknown>,
    scheduledAt: string,
    repeatInterval: RepeatInterval,
  ): Promise<string | null> {
    const r = request();
    if (!r) return null;
    try {
      const { runId } = await r.scheduleRun({
        taskSlug,
        inputs,
        scheduledAt,
        repeatInterval,
      });
      return runId;
    } catch {
      return null;
    }
  },

  async updateScheduledRun(runId: string, scheduledAt: string, repeatInterval: RepeatInterval): Promise<boolean> {
    const r = request();
    if (!r) return false;
    try {
      const { ok } = await r.updateScheduledRun({ runId, scheduledAt, repeatInterval });
      return ok;
    } catch {
      return false;
    }
  },

  async runScheduledNow(runId: string): Promise<boolean> {
    const r = request();
    if (!r) return false;
    try {
      const { ok } = await r.runScheduledNow({ runId });
      return ok;
    } catch {
      return false;
    }
  },

  async getLayout(projectSlug: string): Promise<ProjectLayout> {
    const r = request();
    if (!r) return { cards: [] };
    try {
      return await r.getLayout({ projectSlug });
    } catch {
      return { cards: [] };
    }
  },

  async saveLayout(projectSlug: string, layout: ProjectLayout): Promise<void> {
    await request()?.saveLayout({ projectSlug, layout });
  },

  async getViews(project: string): Promise<ThreadView[]> {
    const r = request();
    if (!r) return [];
    try {
      return await r.getViews({ project });
    } catch {
      return [];
    }
  },

  async saveViews(project: string, views: ThreadView[]): Promise<void> {
    await request()?.saveViews({ project, views });
  },

  async suggestViewName(filterSummary: string, sampleRuns: string[]): Promise<{ ok: boolean; name?: string }> {
    const r = request();
    if (!r) return { ok: false };
    try {
      return await r.suggestViewName({ filterSummary, sampleRuns });
    } catch {
      return { ok: false };
    }
  },

  async getUIState(): Promise<UIState> {
    const r = request();
    if (!r) return { activeProject: null, activeViewByProject: {}, recentProjects: [] };
    try {
      return await r.getUIState({});
    } catch {
      return { activeProject: null, activeViewByProject: {}, recentProjects: [] };
    }
  },

  async saveUIState(state: UIState): Promise<void> {
    await request()?.saveUIState(state);
  },

  async listStarterTasks(): Promise<StarterTask[]> {
    const r = request();
    if (!r) return [];
    try {
      return await r.listStarterTasks({});
    } catch {
      return [];
    }
  },

  async installStarterTasks(projectName: string, slugs: string[]): Promise<{ ok: boolean; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.installStarterTasks({ projectName, slugs });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async chooseDirectory(startingFolder?: string): Promise<string | null> {
    const r = request();
    if (!r) return null;
    try {
      const res = await r.chooseDirectory({ startingFolder });
      return res;
    } catch (err) {
      api.log(`Error choosing directory: ${err}`, "error");
      return null;
    }
  },

  async openFolder(path: string): Promise<boolean> {
    const r = request();
    if (!r) return false;
    try {
      const res = await r.openFolder({ path });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteTask(projectPath: string, slug: string): Promise<{ ok: boolean; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.deleteTask({ projectPath, slug });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async updateTaskMeta(
    projectPath: string,
    slug: string,
    patch: TaskMetaPatch,
  ): Promise<{ ok: boolean; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.updateTaskMeta({ projectPath, slug, patch });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  log(msg: string, type?: "info" | "warn" | "error" | "debug"): void {
    send()?.logToBun({ msg, type });
  },

  async listTools(): Promise<ToolRegistryEntry[]> {
    const r = request();
    if (!r) return [];
    try {
      return await r.listTools({});
    } catch {
      return [];
    }
  },

  async resolveTool(nameOrPath: string): Promise<{ ok: boolean; execPath?: string; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.resolveTool({ nameOrPath });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async registerTool(
    nameOrPath: string,
    name: string | undefined,
    source: ToolSource,
  ): Promise<{ ok: boolean; entry?: ToolRegistryEntry; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.registerTool({ nameOrPath, name, source });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async inspectTool(
    nameOrPath: string,
    name: string | undefined,
    source: ToolSource,
    serviceId: string,
    model: string,
  ): Promise<{ ok: boolean; entry?: ToolRegistryEntry; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.inspectTool({ nameOrPath, name, source, serviceId, model });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async redistillTool(
    id: string,
    helpText: string | undefined,
    serviceId: string,
    model: string,
  ): Promise<{ ok: boolean; entry?: ToolRegistryEntry; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.redistillTool({ id, helpText, serviceId, model });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async updateTool(id: string, name?: string): Promise<{ ok: boolean; entry?: ToolRegistryEntry; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.updateTool({ id, name });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async removeTool(id: string, deleteBinary = false): Promise<void> {
    await request()?.removeTool({ id, deleteBinary });
  },

  async chooseFile(startingFolder?: string): Promise<string | null> {
    const r = request();
    if (!r) return null;
    try {
      return await r.chooseFile({ startingFolder });
    } catch {
      return null;
    }
  },

  async installToolFromPath(path: string): Promise<{ ok: boolean; entry?: ToolRegistryEntry; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.installToolFromPath({ path });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  // Package manager API (ticket 103)
  async listPackageManagers(): Promise<import("../shared/types").PackageManagerInfo[]> {
    const r = request();
    if (!r) return [];
    try {
      return await r.listPackageManagers({});
    } catch {
      return [];
    }
  },

  async detectPackageManagers(): Promise<import("../shared/types").PackageManagerInfo[]> {
    const r = request();
    if (!r) return [];
    try {
      return await r.detectPackageManagers({});
    } catch {
      return [];
    }
  },

  async addCustomPackageManager(
    id: string,
    name: string,
    path: string,
    enabled = true,
  ): Promise<{ ok: boolean; manager?: any; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.addCustomPackageManager({ id, name, path, enabled });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async removeCustomPackageManager(id: string): Promise<void> {
    await request()?.removeCustomPackageManager({ id });
  },

  // Native browser automation (ticket 99) ----------------------------------

  async listNativeTools(): Promise<import("../shared/types").NativeTool[]> {
    const r = request();
    if (!r) return [];
    try {
      return await r.listNativeTools({});
    } catch {
      return [];
    }
  },

  async createNativeTask(input: {
    project: string;
    name: string;
    description: string;
    tags: string[];
    nativeTool: string;
    fields: import("../shared/types").TaskField[];
    outputType: import("../shared/types").OutputType;
    outputs: import("../shared/types").OutputDefinition[];
    browserConfig?: import("../shared/types").BrowserAutomationConfig;
  }): Promise<{ ok: boolean; slug?: string; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.createNativeTask(input);
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async saveBrowserConfig(
    projectPath: string,
    slug: string,
    config: import("../shared/types").BrowserAutomationConfig,
  ): Promise<{ ok: boolean; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.saveBrowserConfig({ projectPath, slug, config });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async runBrowserStep(
    projectPath: string,
    slug: string,
    stepId: string,
    inputs: Record<string, unknown>,
  ): Promise<{ ok: boolean; trace?: string[]; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.runBrowserStep({ projectPath, slug, stepId, inputs });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async startBrowserRecording(url: string): Promise<{ ok: boolean; recordingId?: string; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.startBrowserRecording({ url });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async stopBrowserRecording(
    recordingId: string,
  ): Promise<{ ok: boolean; events?: import("../shared/types").RecordedEvent[]; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.stopBrowserRecording({ recordingId });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async savePackageManagers(list: any[]): Promise<{ ok: boolean; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.savePackageManagers({ list });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async searchPackageManagers(
    query: string,
  ): Promise<{ ok: boolean; results?: import("../shared/types").PackageCatalogItem[]; error?: string }> {
    const r = request();
    if (!r) return { ok: false, results: [], error: "Bridge unavailable" };
    try {
      return await r.searchPackageManagers({ query });
    } catch (err) {
      return { ok: false, results: [], error: String(err) };
    }
  },

  async installPackage(
    managerId: string,
    packageName: string,
  ): Promise<{ ok: boolean; installId?: string; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.installPackage({ managerId, packageName });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async resolvePackageBinaries(
    managerId: string,
    packageName: string,
  ): Promise<{ ok: boolean; binaries?: import("../shared/types").PackageBinary[]; error?: string }> {
    const r = request();
    if (!r) return { ok: false, binaries: [], error: "Bridge unavailable" };
    try {
      return await r.resolvePackageBinaries({ managerId, packageName });
    } catch (err) {
      return { ok: false, binaries: [], error: String(err) };
    }
  },

  async setToolInstalledVia(
    id: string,
    installedVia: { manager: string; package: string; version?: string },
  ): Promise<{ ok: boolean; entry?: import("../shared/types").ToolRegistryEntry; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.setToolInstalledVia({ id, installedVia });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async suggestTools(
    query: string,
    serviceId: string,
    model: string,
  ): Promise<{ ok: boolean; suggestions?: string[]; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.suggestTools({ query, serviceId, model });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async listServiceModels(serviceId: string): Promise<{ ok: boolean; models?: string[]; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.listServiceModels({ serviceId });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async checkToolFreshness(
    id: string,
  ): Promise<{ ok: boolean; stale?: boolean; entry?: ToolRegistryEntry; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.checkToolFreshness({ id });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async draftCommandFields(
    goal: string,
    toolName: string,
    actionName: string,
    spec: ToolSpec,
    serviceId: string,
    model: string,
    project?: string,
  ): Promise<{ ok: boolean; fields?: TaskField[]; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.draftCommandFields({ goal, toolName, actionName, spec, serviceId, model, project });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async registerDroppedTool(
    fileName: string,
    base64: string,
  ): Promise<{ ok: boolean; entry?: ToolRegistryEntry; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.registerDroppedTool({ fileName, base64 });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async createCommandTask(input: {
    project: string;
    name: string;
    description: string;
    tags: string[];
    command: CommandSpec;
    fields: TaskField[];
    outputType: OutputType;
    outputs: OutputDefinition[];
  }): Promise<{ ok: boolean; slug?: string; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.createCommandTask(input);
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async getRunOutputs(runId: string): Promise<OutputResult[]> {
    const r = request();
    if (!r) return [];
    try {
      return await r.getRunOutputs({ runId });
    } catch {
      return [];
    }
  },

  // VFS & file locations (ticket 102) -----------------------------------------

  async listVfsLocations(project?: string): Promise<import("../shared/types").VfsLocation[]> {
    const r = request();
    if (!r) return [];
    try {
      return await r.listVfsLocations({ project });
    } catch {
      return [];
    }
  },

  async addVfsLocation(location: import("../shared/types").VfsLocation): Promise<{ ok: boolean; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.addVfsLocation({ location });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async updateVfsLocation(location: import("../shared/types").VfsLocation): Promise<{ ok: boolean; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.updateVfsLocation({ location });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async removeVfsLocation(id: string, project?: string): Promise<{ ok: boolean; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.removeVfsLocation({ id, project });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async vfsList(
    locationId: string,
    path?: string,
  ): Promise<{ entries: import("../shared/types").VfsStatResult[]; error?: string }> {
    const r = request();
    if (!r) return { entries: [] };
    try {
      return await r.vfsList({ locationId, path });
    } catch (err) {
      return { entries: [], error: String(err) };
    }
  },

  async vfsStat(locationId: string, path: string): Promise<import("../shared/types").VfsStatResult | null> {
    const r = request();
    if (!r) return null;
    try {
      return await r.vfsStat({ locationId, path });
    } catch {
      return null;
    }
  },

  async vfsSearch(
    locationId: string,
    query: string,
  ): Promise<{ paths: string[]; truncated?: boolean; error?: string }> {
    const r = request();
    if (!r) return { paths: [] };
    try {
      return await r.vfsSearch({ locationId, query });
    } catch (err) {
      return { paths: [], error: String(err) };
    }
  },

  async vfsOpen(locationId: string, path: string, reveal?: boolean): Promise<{ ok: boolean; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.vfsOpen({ locationId, path, reveal });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async vfsReadPreview(
    locationId: string,
    path: string,
    maxBytes?: number,
  ): Promise<{ base64: string; mime: string; error?: string }> {
    const r = request();
    if (!r) return { base64: "", mime: "", error: "Bridge unavailable" };
    try {
      return await r.vfsReadPreview({ locationId, path, maxBytes });
    } catch (err) {
      return { base64: "", mime: "", error: String(err) };
    }
  },

  async getRunArtifacts(runId: string): Promise<import("../shared/types").RunArtifact[]> {
    const r = request();
    if (!r) return [];
    try {
      return await r.getRunArtifacts({ runId });
    } catch {
      return [];
    }
  },

  // Workflows (tickets 88-95) -------------------------------------------------

  async listWorkflows(project: string): Promise<Workflow[]> {
    const r = request();
    if (!r) return [];
    try {
      return await r.listWorkflows({ project });
    } catch {
      return [];
    }
  },

  async saveWorkflow(project: string, workflow: Workflow): Promise<{ ok: boolean; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.saveWorkflow({ project, workflow });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async deleteWorkflow(project: string, id: string): Promise<void> {
    await request()?.deleteWorkflow({ project, id });
  },

  async startWorkflowRun(
    project: string,
    workflowId: string,
    params?: Record<string, string>,
  ): Promise<{ ok: boolean; runId?: string; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.startWorkflowRun({ project, workflowId, params });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async cancelWorkflowRun(project: string, runId: string): Promise<void> {
    await request()?.cancelWorkflowRun({ project, runId });
  },

  async listWorkflowRuns(project: string, workflowId?: string): Promise<WorkflowRunSummary[]> {
    const r = request();
    if (!r) return [];
    try {
      return await r.listWorkflowRuns({ project, workflowId });
    } catch {
      return [];
    }
  },

  async getWorkflowRun(project: string, runId: string): Promise<WorkflowRun | null> {
    const r = request();
    if (!r) return null;
    try {
      return await r.getWorkflowRun({ project, runId });
    } catch {
      return null;
    }
  },

  async dryRunWorkflow(
    project: string,
    workflowId: string,
    params?: Record<string, string>,
  ): Promise<{ ok: boolean; plan?: WorkflowPlanEntry[]; problems?: string[]; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.dryRunWorkflow({ project, workflowId, params });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async replayWorkflowStep(
    project: string,
    runId: string,
    recordIndex: number,
  ): Promise<{ ok: boolean; record?: WorkflowStepRecord; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.replayWorkflowStep({ project, runId, recordIndex });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async draftWorkflow(
    project: string,
    goal: string,
    name: string,
    serviceId: string,
    model: string,
  ): Promise<{ ok: boolean; workflow?: Workflow; notes?: string[]; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.draftWorkflow({ project, goal, name, serviceId, model });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async duplicateWorkflow(project: string, id: string): Promise<{ ok: boolean; workflow?: Workflow; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.duplicateWorkflow({ project, id });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  // Task adoption & versioning (ticket 105) -----------------------------------

  async adoptTask(projectPath: string, slug: string): Promise<{ ok: boolean; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.adoptTask({ projectPath, slug });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async saveTaskVersion(
    projectPath: string,
    slug: string,
    meta: Omit<import("../shared/types").TaskMeta, "slug" | "createdAt" | "updatedAt">,
    task: import("../shared/types").TaskDefinition,
  ): Promise<{ ok: boolean; version?: number; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.saveTaskVersion({ projectPath, slug, meta, task });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async listTaskVersions(
    projectPath: string,
    slug: string,
  ): Promise<{ ok: boolean; versions?: import("../shared/types").TaskVersionInfo[]; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.listTaskVersions({ projectPath, slug });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async loadTaskVersion(
    projectPath: string,
    slug: string,
    version: number,
  ): Promise<{ ok: boolean; folder?: TaskFolder; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.loadTaskVersion({ projectPath, slug, version });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async rollbackTaskVersion(
    projectPath: string,
    slug: string,
    version: number,
  ): Promise<{ ok: boolean; newVersion?: number; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.rollbackTaskVersion({ projectPath, slug, version });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async getWorkflowsReferencingTask(
    projectPath: string,
    slug: string,
  ): Promise<{ workflows: import("../shared/types").WorkflowTaskReference[] }> {
    const r = request();
    if (!r) return { workflows: [] };
    try {
      return await r.getWorkflowsReferencingTask({ projectPath, slug });
    } catch {
      return { workflows: [] };
    }
  },

  async upgradeWorkflowTaskVersion(
    projectPath: string,
    workflowId: string,
    stepNames: string[],
    newVersion: number,
  ): Promise<{ ok: boolean; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.upgradeWorkflowTaskVersion({ projectPath, workflowId, stepNames, newVersion });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },
};
