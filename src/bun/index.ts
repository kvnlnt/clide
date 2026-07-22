import { ApplicationMenu, BrowserView, BrowserWindow, Updater, Utils } from "electrobun/bun";
import { existsSync, rmSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import type {
  AIService,
  ClideCompanionRPC,
  ClideRPC,
  OutputChunk,
  ProfileScope,
  Project,
  RunStatusUpdate,
  ToolRegistryEntry,
  ToolSource,
  Workflow,
  WorkflowRunTriggerInfo,
} from "../shared/types";
import { projectProfileToSections, userProfileToSections } from "../shared/profile";
import {
  getAIService,
  getDefaultAIService,
  listAIServices,
  listServiceModels,
  previewServiceModels,
  saveAIServices,
  testAIService,
} from "./ai/aiServices";
import { draftCommandFields } from "./ai/commandFields";
import { hasCredential, saveCredential } from "./ai/credentials";
import {
  critiqueInterviewSession,
  draftProfileSections,
  nextInterviewQuestion,
  reflectOnActivity,
  type InterviewContext,
} from "./ai/interview";
import { fillMagicFields } from "./ai/magicFill";
import { renderUserProfileBlock } from "./ai/profileContext";
import { distillToolSpec, suggestTools } from "./ai/toolSpec";
import { generateViewName } from "./ai/viewNaming";
import { draftWorkflow } from "./ai/workflowDraft";
import {
  addProject,
  listProjects,
  loadProjects,
  projectPaths,
  removeProject,
  renameProject,
  resolveProjectByName,
} from "./config";
import { deleteRun as dbDeleteRun, getAllRuns, getRun, getRunHistory, indexRuns, setPinned } from "./db/history";
import { ensureDir, formDir, projectFormsDir } from "./paths";
import {
  appendUserSelfNote,
  deleteUserProfile as deleteUserProfileFile,
  readUserProfile,
  writeUserProfile,
} from "./profile";
import {
  appendProjectSelfNote,
  deleteProjectProfile as deleteProjectProfileFile,
  readProjectProfile,
  writeProjectProfile,
} from "./projectProfile";
import { cancelRun, readRunOutputs, setRunCompletionListener, startRun, type RunEmitters } from "./runner/execute";
import {
  cancelScheduled,
  deleteOccurrence,
  disposeScheduler,
  initScheduler,
  rescheduleRun,
  runScheduledNow,
  schedule,
} from "./scheduler";
import { readLayout, writeLayout } from "./tasks/layout";
import { listTasks, loadTaskFolder, resolveTaskProject } from "./tasks/loader";
import { readViews, writeViews } from "./tasks/views";
import { watchTasks } from "./tasks/watcher";
import { writeCommandTask } from "./tasks/writer";
import { captureFingerprint, captureHelp, resolveTool as resolveToolPath } from "./tools/inspect";
import {
  findByRealPath,
  getTool,
  listTools as listRegisteredTools,
  registerBinaryBytes,
  removeTool,
  saveTool,
} from "./tools/registry";
import { installStarterTasks, listStarterTasks } from "./tasks/seed";
import { installStarterWorkflows, listStarterWorkflows } from "./workflows/seed";
import { readUIState, writeUIState } from "./uiState";
import {
  cancelWorkflowRun as engineCancelRun,
  dryRunWorkflow as engineDryRun,
  replayStep as engineReplayStep,
  startWorkflowRun as engineStartRun,
} from "./workflows/engine";
import {
  failInterruptedRuns,
  getRun as getWorkflowRunFile,
  listRuns as listWorkflowRunFiles,
} from "./workflows/runStore";
import {
  cancelScheduledWorkflowRun,
  deleteWorkflowOccurrence,
  disposeWorkflowSchedules,
  getScheduledWorkflows,
  initWorkflowSchedules,
  rescheduleWorkflowRun as rescheduleWorkflowRunSchedule,
  runScheduledWorkflowRunNow,
  scheduleWorkflowRun,
} from "./workflows/schedules";
import {
  getWorkflow,
  deleteWorkflow as storeDeleteWorkflow,
  duplicateWorkflow as storeDuplicateWorkflow,
  listWorkflows as storeListWorkflows,
  saveWorkflow as storeSaveWorkflow,
  validateForSave,
} from "./workflows/store";
import { exportReportToFile } from "./reports/export";
import {
  deleteReport as storeDeleteReport,
  getReport,
  listReports as storeListReports,
  saveReport as storeSaveReport,
  validateForSave as validateReportForSave,
} from "./reports/store";
import {
  disposeWorkflowTriggers,
  initWorkflowTriggers,
  onTaskRunCompleted,
  refreshWorkflowTriggers,
} from "./workflows/triggers";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// ---------------------------------------------------------------------------
// Bootstrap on-disk state. Projects are folders on disk; a genuinely empty
// registry is now a real, reachable state — the first-project takeover
// (ticket 78) owns that experience, so we no longer auto-seed demo projects
// on top of it (see tasks/seed.ts, kept for dev-profile fixtures, ticket 79).
// ---------------------------------------------------------------------------
await loadProjects();
indexRuns(await projectPaths());

/** Resolve a project name to its folder path. */
async function pathForProjectName(name: string): Promise<Project | null> {
  return resolveProjectByName(name);
}

/** Resolve the project a task slug belongs to (path + display name). */
async function projectForSlug(slug: string): Promise<Project | null> {
  const path = resolveTaskProject(slug);
  if (!path) {
    // Index may be stale (e.g. file added externally) — refresh and retry.
    await listTasks();
  }
  const resolved = resolveTaskProject(slug);
  if (!resolved) return null;
  const projects = await listProjects();
  return (
    projects.find((p) => p.path === resolved) ?? {
      path: resolved,
      name: resolved,
    }
  );
}

// ---------------------------------------------------------------------------
// Renderer emitters — push streaming output/status to the webview.
// ---------------------------------------------------------------------------
let mainWindow: BrowserWindow | null = null;
let companionWindow: BrowserWindow | null = null;

function sendToView(name: string, payload: unknown): void {
  try {
    const send = (mainWindow?.webview?.rpc as { send?: Record<string, (p: unknown) => void> } | undefined)?.send;
    send?.[name]?.(payload);
  } catch (err) {
    console.warn(`[rpc] Failed to send ${name}:`, err);
  }
}

function sendToCompanion(name: string, payload: unknown): void {
  try {
    const send = (companionWindow?.webview?.rpc as { send?: Record<string, (p: unknown) => void> } | undefined)
      ?.send;
    send?.[name]?.(payload);
  } catch (err) {
    console.warn(`[rpc] Failed to send ${name} to companion:`, err);
  }
}

const emitters: RunEmitters = {
  emitChunk: (chunk: OutputChunk) => sendToView("onOutputChunk", chunk),
  emitStatus: (update: RunStatusUpdate) => sendToView("onRunStatus", update),
};

// ---------------------------------------------------------------------------
// Voice companion (ticket 138): a second, small chromeless "Jarvis" window.
// It owns no speech APIs itself — the main window's existing
// speechSynthesis/SpeechRecognition calls (tickets 123/137) stay the single
// source of truth, and their lifecycle events are relayed here so the
// companion can animate. Position/enabled/muted persist via UIState; the
// window itself does not — every launch creates it fresh when enabled.
// ---------------------------------------------------------------------------
const COMPANION_GREETING = "Hello, welcome to CLIDE. How can I help you today?";
const COMPANION_SIZE = { width: 220, height: 220 };
/** Only speak the greeting on the first companion window of this process lifetime — re-showing after a manual hide never re-greets. */
let companionGreetedThisSession = false;
let companionMoveDebounce: ReturnType<typeof setTimeout> | null = null;

async function getCompanionUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      const url = `${DEV_SERVER_URL}/companion/index.html`;
      await fetch(url, { method: "HEAD" });
      return url;
    } catch {
      // fall through to the packaged view
    }
  }
  return "views://mainview/companion.html";
}

/** Creates the companion window on first call; otherwise just shows/activates the existing one. */
async function ensureCompanionWindow(): Promise<void> {
  if (companionWindow) {
    companionWindow.show();
    companionWindow.activate();
    return;
  }
  const ui = await readUIState();
  const pos = ui.companionPosition;
  const url = await getCompanionUrl();

  companionWindow = new BrowserWindow({
    title: "CLIDE Companion",
    url,
    frame: {
      x: pos?.x ?? 40,
      y: pos?.y ?? 40,
      width: COMPANION_SIZE.width,
      height: COMPANION_SIZE.height,
    },
    titleBarStyle: "hidden",
    transparent: true,
    passthrough: false,
    rpc: companionRpc,
  });
  companionWindow.setAlwaysOnTop(true);

  companionWindow.on("move", (event) => {
    const { x, y } = (event as { data: { x: number; y: number } }).data;
    if (companionMoveDebounce) clearTimeout(companionMoveDebounce);
    companionMoveDebounce = setTimeout(() => {
      void readUIState().then((state) => writeUIState({ ...state, companionPosition: { x, y } }));
    }, 400);
  });

  companionWindow.on("close", () => {
    companionWindow = null;
  });
}

async function showCompanionWindow(): Promise<void> {
  const state = await readUIState();
  await writeUIState({ ...state, companionEnabled: true });
  await ensureCompanionWindow();
  sendToView("onCompanionEnabledChanged", { enabled: true });
}

async function hideCompanionWindow(): Promise<void> {
  companionWindow?.hide();
  const state = await readUIState();
  await writeUIState({ ...state, companionEnabled: false });
  sendToView("onCompanionEnabledChanged", { enabled: false });
}

async function setCompanionMutedState(muted: boolean): Promise<void> {
  const state = await readUIState();
  await writeUIState({ ...state, companionMuted: muted });
  sendToView("onCompanionMutedChanged", { muted });
}

const companionRpc = BrowserView.defineRPC<ClideCompanionRPC>({
  maxRequestTime: 10000,
  handlers: {
    requests: {
      companionReady: async () => {
        const ui = await readUIState();
        return { muted: ui.companionMuted === true };
      },
      setCompanionMuted: async ({ muted }) => {
        await setCompanionMutedState(muted);
      },
      hideCompanion: async () => {
        await hideCompanionWindow();
      },
      resizeCompanion: async ({ width, height }) => {
        companionWindow?.setSize(width, height);
      },
    },
    messages: {
      logToBun: ({ msg, type }) => {
        const tag = "[companion]";
        if (type === "error") console.error(tag, msg);
        else if (type === "warn") console.warn(tag, msg);
        else console.log(tag, msg);
      },
    },
  },
});

async function pushTasksChanged(): Promise<void> {
  const tasks = await listTasks();
  sendToView("onTasksChanged", { tasks });
}

async function pushProjectsChanged(): Promise<void> {
  const projects = await listProjects();
  sendToView("onProjectsChanged", { projects });
  await refreshWorkflowTriggers(projects);
}

// ---------------------------------------------------------------------------
// Workflows (tickets 88-95): engine starter + trigger wiring.
// ---------------------------------------------------------------------------

function startWorkflow(
  project: Project,
  workflow: Workflow,
  trigger: WorkflowRunTriggerInfo,
  triggerEnv: Record<string, unknown>,
): string {
  return engineStartRun(project.path, project.name, workflow, trigger, triggerEnv, (run) =>
    sendToView("onWorkflowRunUpdate", { run }),
  );
}

// Standalone task completions feed task-submitted triggers (never cascades —
// workflow-internal steps use execTaskOnce, which bypasses this listener).
setRunCompletionListener(onTaskRunCompleted);
initWorkflowTriggers((project, workflow, trigger, env) => {
  startWorkflow(project, workflow, trigger, env);
});
await refreshWorkflowTriggers(await listProjects());
// Runs left "running" by a previous session can never finish — mark them failed.
for (const p of await projectPaths()) {
  await failInterruptedRuns(p);
}

// ---------------------------------------------------------------------------
// MIME detection for file-based outputs.
// ---------------------------------------------------------------------------
const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

async function readOutputFile(runId: string): Promise<{ mime: string; base64: string } | null> {
  const run = getRun(runId);
  if (!run || !run.outputPath) return null;
  const project = await projectForSlug(run.taskSlug);
  const folder = project ? await loadTaskFolder(project.path, run.taskSlug, project.name) : null;
  const outputType = folder?.task.outputType ?? "text";

  try {
    if (outputType === "image" || outputType === "audio" || outputType === "video") {
      // The captured output contains the file path printed by the script.
      const printed = (await Bun.file(run.outputPath).text()).trim();
      const path = printed.split("\n").pop()?.trim() ?? printed;
      const file = Bun.file(path);
      if (!(await file.exists())) return null;
      const bytes = new Uint8Array(await file.arrayBuffer());
      return {
        mime: MIME[extname(path).toLowerCase()] ?? "application/octet-stream",
        base64: Buffer.from(bytes).toString("base64"),
      };
    }
    // Text-like outputs: return the captured text directly.
    const text = await Bun.file(run.outputPath).text();
    return {
      mime: "text/plain",
      base64: Buffer.from(text, "utf-8").toString("base64"),
    };
  } catch {
    return null;
  }
}

async function readTaskScript(taskSlug: string): Promise<{ script: string; extension: string } | null> {
  const project = await projectForSlug(taskSlug);
  if (!project) return null;
  const folder = await loadTaskFolder(project.path, taskSlug, project.name);
  if (!folder?.task.scriptFile) return null;
  try {
    const scriptPath = join(formDir(project.path, taskSlug), folder.task.scriptFile);
    const script = await Bun.file(scriptPath).text();
    const extension = extname(folder.task.scriptFile).replace(/^\./, "");
    return { script, extension };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tool registry helpers (ticket 53).
// ---------------------------------------------------------------------------

function basename(p: string): string {
  return p.split("/").filter(Boolean).pop() ?? p;
}

/** Resolves + dedupes against an existing entry, or builds a fresh bare-bones one. Does not capture help. */
async function resolveOrCreateEntry(
  nameOrPath: string,
  name: string | undefined,
  source: ToolSource,
): Promise<{ ok: true; entry: ToolRegistryEntry } | { ok: false; error: string }> {
  const resolved = resolveToolPath(nameOrPath);
  if (!resolved.ok || !resolved.execPath) {
    return { ok: false, error: resolved.error ?? `Could not resolve "${nameOrPath}"` };
  }
  const existing = await findByRealPath(resolved.execPath);
  if (existing) return { ok: true, entry: existing };
  return {
    ok: true,
    entry: {
      id: crypto.randomUUID(),
      name: name?.trim() || basename(resolved.execPath),
      execPath: resolved.execPath,
      source,
    },
  };
}

// ---------------------------------------------------------------------------
// Profile interview helpers (tickets 100/101).
// ---------------------------------------------------------------------------

/**
 * Resolve the service powering an interview session (ticket 107): the caller's
 * chosen service (with optional model override), falling back to the default
 * service when the id is absent or no longer exists.
 */
async function interviewAIService(serviceId?: string, model?: string): Promise<AIService | undefined> {
  const services = await listAIServices();
  const base =
    (serviceId ? services.find((s) => s.id === serviceId) : undefined) ??
    services.find((s) => s.isDefault) ??
    services[0];
  if (!base) return undefined;
  return model?.trim() ? { ...base, model: model.trim() } : base;
}

/** Assemble the scope-specific engine context: schema sections, existing profile, selfNotes, app context. */
async function buildInterviewContext(scope: ProfileScope, projectPath?: string): Promise<InterviewContext> {
  if (scope === "project") {
    if (!projectPath) throw new Error("projectPath required for project-scope profiles");
    const [proj, app, projects] = await Promise.all([
      readProjectProfile(projectPath),
      readUserProfile(),
      listProjects(),
    ]);
    return {
      scope,
      projectName: projects.find((p) => p.path === projectPath)?.name ?? basename(projectPath),
      existing: projectProfileToSections(proj),
      hasProfile: proj !== null,
      selfNotes: proj?.selfNotes ?? "",
      appProfileBlock: app ? renderUserProfileBlock(app) || null : null,
      appSections: app ? userProfileToSections(app) : undefined,
    };
  }
  const app = await readUserProfile();
  return {
    scope,
    existing: userProfileToSections(app),
    hasProfile: app !== null,
    selfNotes: app?.selfNotes ?? "",
    appProfileBlock: null,
  };
}

/**
 * Compact recent-usage digest for the reflection pass (ticket 100 §4). Built
 * from task names, statuses and (already secret-masked) run summaries only —
 * raw inputs never reach the prompt.
 */
async function buildActivitySummary(scope: ProfileScope, projectPath?: string): Promise<string> {
  const projects = await listProjects();
  const scoped = scope === "project" ? projects.filter((p) => p.path === projectPath) : projects;
  const paths = scoped.map((p) => p.path);
  if (paths.length === 0) return "(no activity recorded)";

  const tasks = await listTasks();
  const nameBySlug = new Map(tasks.map((t) => [t.meta.slug, t.meta.name]));
  const runs = getAllRuns(paths).slice(0, 200);

  const byTask = new Map<string, { total: number; error: number; summaries: string[] }>();
  for (const run of runs) {
    const entry = byTask.get(run.taskSlug) ?? { total: 0, error: 0, summaries: [] };
    entry.total += 1;
    if (run.status === "error") entry.error += 1;
    if (run.summary && entry.summaries.length < 2) entry.summaries.push(run.summary);
    byTask.set(run.taskSlug, entry);
  }

  const lines = [...byTask.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 25)
    .map(([slug, e]) => {
      const label = nameBySlug.get(slug) ?? slug;
      const failures = e.error > 0 ? `, ${e.error} failed` : "";
      const samples = e.summaries.length > 0 ? ` — e.g. ${e.summaries.join(" / ")}` : "";
      return `- Task "${label}": ${e.total} recent runs${failures}${samples}`;
    });

  if (scope === "app") {
    const taskCounts = new Map<string, number>();
    for (const t of tasks) taskCounts.set(t.meta.project, (taskCounts.get(t.meta.project) ?? 0) + 1);
    lines.unshift(
      `Projects: ${scoped.map((p) => `"${p.name}" (${taskCounts.get(p.name) ?? 0} tasks)`).join(", ")}`,
    );
  }

  return lines.length > 0 ? lines.join("\n") : "(no activity recorded)";
}

// ---------------------------------------------------------------------------
// RPC definition.
// ---------------------------------------------------------------------------
const rpc = BrowserView.defineRPC<ClideRPC>({
  maxRequestTime: 60000,
  handlers: {
    requests: {
      closeWindow: async () => {
        await mainWindow?.close();
      },

      minimizeWindow: async () => {
        await mainWindow?.minimize();
      },

      listProjects: async () => await listProjects(),

      addProject: async ({ name, path }) => {
        try {
          const project = await addProject(name, path);
          await pushProjectsChanged();
          return { ok: true, project };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      renameProject: async ({ path, name }) => {
        try {
          const project = await renameProject(path, name);
          await pushProjectsChanged();
          await pushTasksChanged();
          return { ok: true, project };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      removeProject: async ({ path, deleteFiles }) => {
        await removeProject(path, deleteFiles === true);
        await pushProjectsChanged();
        await pushTasksChanged();
      },

      getTrackUnread: async ({ path }) => {
        return await import("./config").then((m) => m.getTrackUnread(path));
      },

      setTrackUnread: async ({ path, trackUnread }) => {
        const { setTrackUnread, getTrackUnread } = await import("./config");
        const wasTracking = await getTrackUnread(path);
        await setTrackUnread(path, trackUnread);
        // Turning on after being off: bulk-mark existing unread as read (ticket 97).
        if (!wasTracking && trackUnread) {
          const { markAllRunsRead } = await import("./db/history");
          const { markAllWorkflowRunsRead } = await import("./workflows/runStore");
          markAllRunsRead(path);
          await markAllWorkflowRunsRead(path);
        }
      },

      listTasks: async () => await listTasks(),

      getRunHistory: async ({ taskSlug, limit }) => {
        const project = await projectForSlug(taskSlug);
        if (!project) return [];
        return getRunHistory(project.path, taskSlug, limit);
      },

      getAllRuns: async ({ project }) => {
        if (project === null) return getAllRuns(await projectPaths());
        const resolved = await pathForProjectName(project);
        if (!resolved) return [];
        return getAllRuns([resolved.path]);
      },

      runTask: async ({ taskSlug, inputs }) => {
        const project = await projectForSlug(taskSlug);
        if (!project) throw new Error(`Task not found: ${taskSlug}`);
        return await startRun(project.path, project.name, taskSlug, inputs, emitters);
      },

      cancelRun: ({ runId }) => {
        cancelRun(runId, emitters);
      },

      readOutputFile: async ({ runId }) => await readOutputFile(runId),

      getTaskScript: async ({ taskSlug }) => await readTaskScript(taskSlug),

      saveServiceCredential: async ({ serviceId, key }) => {
        await saveCredential(serviceId, key);
      },

      hasServiceCredential: async ({ serviceId }) => await hasCredential(serviceId),

      listAIServices: async () => await listAIServices(),

      saveAIServices: async ({ services }) => {
        await saveAIServices(services);
      },

      testAIService: async ({ serviceId }) => await testAIService(serviceId),

      fillMagicFields: async ({ taskSlug, fields }) => {
        try {
          const project = await projectForSlug(taskSlug);
          if (!project) return { ok: false, error: `Task not found: ${taskSlug}` };
          const folder = await loadTaskFolder(project.path, taskSlug, project.name);
          if (!folder) return { ok: false, error: `Task not found: ${taskSlug}` };
          const values = await fillMagicFields(folder, fields);
          return { ok: true, values };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      // Profiles (tickets 100/101) --------------------------------------------

      getUserProfile: async () => await readUserProfile(),

      saveUserProfile: async ({ profile }) => {
        try {
          await writeUserProfile(profile);
          return { ok: true };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      deleteUserProfile: async () => {
        deleteUserProfileFile();
      },

      getProjectProfile: async ({ projectPath }) => await readProjectProfile(projectPath),

      saveProjectProfile: async ({ projectPath, profile }) => {
        try {
          await writeProjectProfile(projectPath, profile);
          return { ok: true };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      deleteProjectProfile: async ({ projectPath }) => {
        deleteProjectProfileFile(projectPath);
      },

      profileInterviewNext: async ({ scope, projectPath, transcript, serviceId, model }) => {
        try {
          const service = await interviewAIService(serviceId, model);
          if (!service) return { ok: false, error: "No AI service configured — add one in Settings" };
          const ctx = await buildInterviewContext(scope, projectPath);
          const { question, category } = await nextInterviewQuestion(service, ctx, transcript);
          return question ? { ok: true, question, category } : { ok: true, done: true };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      profileInterviewFinish: async ({ scope, projectPath, transcript, serviceId, model }) => {
        try {
          const service = await interviewAIService(serviceId, model);
          if (!service) return { ok: false, error: "No AI service configured — add one in Settings" };
          const ctx = await buildInterviewContext(scope, projectPath);
          const sections = await draftProfileSections(service, ctx, transcript);
          // Self-critique (§4) is best-effort — a drafted profile never fails on it.
          let selfNotes = ctx.selfNotes;
          try {
            selfNotes = await critiqueInterviewSession(service, ctx, transcript);
          } catch (err) {
            console.warn("[interview] self-critique failed:", err);
          }
          return {
            ok: true,
            sections,
            selfNotes,
            suggestAppInterview: scope === "project" && ctx.appProfileBlock === null,
          };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      profileReflect: async ({ scope, projectPath }) => {
        try {
          const service = await getDefaultAIService();
          if (!service) return { ok: false, error: "No AI service configured — add one in Settings" };
          const ctx = await buildInterviewContext(scope, projectPath);
          const activity = await buildActivitySummary(scope, projectPath);
          const { amendments, appAmendments } = await reflectOnActivity(service, ctx, activity);
          return { ok: true, amendments, appAmendments };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      recordProfileRejection: async ({ scope, projectPath, note }) => {
        if (scope === "project" && projectPath) await appendProjectSelfNote(projectPath, note);
        else await appendUserSelfNote(note);
      },

      listTools: async () => await listRegisteredTools(),

      listNativeTools: async () => {
        const { listNativeTools } = await import("./tools/native");
        return listNativeTools();
      },

      resolveTool: async ({ nameOrPath }) => {
        const result = resolveToolPath(nameOrPath);
        return result.ok ? { ok: true, execPath: result.execPath } : { ok: false, error: result.error };
      },

      registerTool: async ({ nameOrPath, name, source }) => {
        const resolved = await resolveOrCreateEntry(nameOrPath, name, source);
        if (!resolved.ok) return resolved;
        await saveTool(resolved.entry);
        return { ok: true, entry: resolved.entry };
      },

      inspectTool: async ({ nameOrPath, name, source, serviceId, model }) => {
        const resolved = await resolveOrCreateEntry(nameOrPath, name, source);
        if (!resolved.ok) return resolved;
        const service = await getAIService(serviceId);
        if (!service) return { ok: false, error: "Selected AI service not found." };

        const captured = await captureHelp(resolved.entry.execPath);
        // Fingerprint alongside the help capture (ticket 60) — the consent the
        // user just gave covers both probes of the same binary.
        const fingerprint = await captureFingerprint(resolved.entry.execPath);
        let entry = { ...resolved.entry, fingerprint };
        if (captured) entry = { ...entry, helpText: captured.text };

        try {
          const spec = captured ? await distillToolSpec(entry.name, captured.text, service, model) : undefined;
          entry = {
            ...entry,
            spec,
            inspectedAt: spec ? new Date().toISOString() : entry.inspectedAt,
            inspectedWith: spec ? { serviceId, model } : entry.inspectedWith,
          };
        } catch (err) {
          // Distillation failure keeps the raw help text usable — not fatal.
          await saveTool(entry);
          return { ok: true, entry, error: `AI distillation failed: ${String(err)}` };
        }

        await saveTool(entry);
        return { ok: true, entry };
      },

      // Provenance stamp after a package-manager-driven install (ticket 103 §4).
      setToolInstalledVia: async ({ id, installedVia }) => {
        const entry = await getTool(id);
        if (!entry) return { ok: false, error: "Tool not found." };
        const updated = { ...entry, installedVia };
        await saveTool(updated);
        return { ok: true, entry: updated };
      },

      checkToolFreshness: async ({ id }) => {
        const entry = await getTool(id);
        if (!entry) return { ok: false, error: "Tool not found." };
        try {
          // Only run the --version probe if a prior inspection proves the user
          // already consented to executing this binary; otherwise stat-only.
          const consented = entry.inspectedAt !== undefined || entry.helpText !== undefined;
          const current = await captureFingerprint(entry.execPath, consented);
          if (!entry.fingerprint) {
            // Pre-fingerprint entry (or never inspected): backfill without
            // flagging stale — there's no baseline to have drifted from.
            const updated = { ...entry, fingerprint: current };
            await saveTool(updated);
            return { ok: true, stale: false, entry: updated };
          }
          return { ok: true, stale: entry.fingerprint !== current, entry };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      // Tool test modal REPL (ticket 136) -------------------------------------
      runToolTest: async ({ execPath, args }) => {
        try {
          const { runToolTest, parseArgs } = await import("./tools/testRun");
          const runId = `tooltest:${crypto.randomUUID()}`;
          const argv = parseArgs(args);
          sendToView("onRunStatus", { runId, status: "running", exitCode: null, finishedAt: null });
          void runToolTest(
            runId,
            execPath,
            argv,
            (type, data) => sendToView("onOutputChunk", { runId, type, data, timestamp: Date.now() }),
            (exitCode, timedOut, truncated) => {
              const summary = timedOut ? "Timed out" : truncated ? "Output truncated" : undefined;
              sendToView("onRunStatus", {
                runId,
                status: timedOut || exitCode !== 0 ? "error" : "success",
                exitCode,
                finishedAt: new Date().toISOString(),
                summary,
              });
            },
          );
          return { ok: true, runId };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      cancelToolTest: async ({ runId }) => {
        try {
          const { cancelToolTest } = await import("./tools/testRun");
          return { ok: cancelToolTest(runId) };
        } catch {
          return { ok: false };
        }
      },

      redistillTool: async ({ id, helpText, serviceId, model }) => {
        const existing = await getTool(id);
        if (!existing) return { ok: false, error: "Tool not found." };
        const text = helpText?.trim() || existing.helpText;
        if (!text) return { ok: false, error: "No help text to distill — paste some first." };
        const service = await getAIService(serviceId);
        if (!service) return { ok: false, error: "Selected AI service not found." };
        try {
          const spec = await distillToolSpec(existing.name, text, service, model);
          const entry: ToolRegistryEntry = {
            ...existing,
            helpText: text,
            spec,
            inspectedAt: new Date().toISOString(),
            inspectedWith: { serviceId, model },
          };
          await saveTool(entry);
          return { ok: true, entry };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      updateTool: async ({ id, name }) => {
        const existing = await getTool(id);
        if (!existing) return { ok: false, error: "Tool not found." };
        if (name !== undefined && !name.trim()) return { ok: false, error: "Name required" };
        const entry: ToolRegistryEntry = { ...existing, name: name?.trim() || existing.name };
        await saveTool(entry);
        return { ok: true, entry };
      },

      removeTool: async ({ id, deleteBinary }) => {
        await removeTool(id, deleteBinary === true);
      },

      registerDroppedTool: async ({ fileName, base64 }) => {
        try {
          const bytes = new Uint8Array(Buffer.from(base64, "base64"));
          const entry = await registerBinaryBytes(fileName, bytes);
          return { ok: true, entry };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      chooseFile: async ({ startingFolder }) => {
        const paths = await Utils.openFileDialog({
          startingFolder: startingFolder ?? "~/",
          canChooseDirectory: false,
          canChooseFiles: true,
          allowsMultipleSelection: false,
        });
        return paths?.[0] ?? null;
      },

      installToolFromPath: async ({ path }) => {
        try {
          const st = statSync(path);
          if (st.isDirectory()) {
            return {
              ok: false,
              error: "That's a folder (app bundles are folders too) — pick the executable file itself.",
            };
          }
          const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
          if (bytes.length === 0) return { ok: false, error: "That file is empty." };
          const entry = await registerBinaryBytes(basename(path), bytes);
          return { ok: true, entry };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      // Package manager RPCs (ticket 103)
      listPackageManagers: async () => {
        try {
          const pm = await import("./tools/packageManagers");
          return await pm.listPackageManagers();
        } catch (err) {
          return [];
        }
      },

      detectPackageManagers: async () => {
        try {
          const pm = await import("./tools/packageManagers");
          return await pm.detectPackageManagers();
        } catch (err) {
          return [];
        }
      },

      addCustomPackageManager: async ({ id, name, path, enabled }) => {
        try {
          const pm = await import("./tools/packageManagers");
          const mgr = await pm.addCustomPackageManager(id, name, path, enabled === true);
          return { ok: true, manager: mgr };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      removeCustomPackageManager: async ({ id }) => {
        try {
          const pm = await import("./tools/packageManagers");
          await pm.removeCustomPackageManager(id);
        } catch {
          /* ignore */
        }
      },

      savePackageManagers: async ({ list }) => {
        try {
          const pm = await import("./tools/packageManagers");
          await pm.savePackageManagersOrder(list);
          return { ok: true };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      searchPackageManagers: async ({ query }) => {
        try {
          const pm = await import("./tools/packageManagers");
          return await pm.searchPackageManagers(query);
        } catch (err) {
          return { ok: false, results: [], error: String(err) };
        }
      },

      installPackage: async ({ managerId, packageName }) => {
        try {
          const pm = await import("./tools/packageManagers");
          // start install and stream via onOutputChunk emitter
          const installId = crypto.randomUUID();
          (async () => {
            await pm.installPackage(managerId, packageName, (chunk: string) => {
              sendToView("onOutputChunk", {
                runId: `install:${installId}`,
                type: "stdout",
                data: chunk,
                timestamp: Date.now(),
              });
            });
            sendToView("onRunStatus", {
              runId: `install:${installId}`,
              status: "success",
              exitCode: 0,
              finishedAt: new Date().toISOString(),
            });
          })();
          return { ok: true, installId };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      cancelPackageInstall: async ({ installId: _installId }) => {
        // Cancellation not implemented in this simplified adapter set.
        return { ok: false };
      },

      resolvePackageBinaries: async ({ managerId, packageName }) => {
        try {
          const pm = await import("./tools/packageManagers");
          return await pm.resolvePackageBinaries(managerId, packageName);
        } catch (err) {
          return { ok: false, binaries: [], error: String(err) };
        }
      },

      suggestTools: async ({ query, serviceId, model }) => {
        const service = await getAIService(serviceId);
        if (!service) return { ok: false, error: "Selected AI service not found." };
        try {
          const names = await suggestTools(query, service, model);
          const verified = names.filter((name) => resolveToolPath(name).ok);
          return { ok: true, suggestions: verified };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      listServiceModels: async ({ serviceId }) => {
        try {
          const models = await listServiceModels(serviceId);
          if (models.length === 0) return { ok: false, error: "Service not found" };
          return { ok: true, models };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      previewServiceModels: async ({ kind, baseUrl, credential, existingServiceId, preferredModel }) => {
        try {
          const models = await previewServiceModels({ kind, baseUrl, credential, existingServiceId, preferredModel });
          return { ok: true, models };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      draftCommandFields: async ({ goal, toolName, actionName, spec, serviceId, model, project }) => {
        const service = await getAIService(serviceId);
        if (!service) return { ok: false, error: "Selected AI service not found." };
        try {
          const resolved = project ? await pathForProjectName(project) : null;
          const fields = await draftCommandFields(
            goal,
            toolName,
            actionName,
            spec,
            service,
            model,
            resolved?.path,
            resolved?.name,
          );
          return { ok: true, fields };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      createCommandTask: async ({ project, name, description, tags, command, fields, outputType, outputs }) => {
        try {
          const resolvedProject = (await resolveProjectByName(project)) ?? (await addProject(project));
          const slug = await writeCommandTask(
            resolvedProject.path,
            { name, description, project: resolvedProject.name, tags, lifecycle: "draft", version: 1 },
            { fields, outputType, outputs, command },
          );
          await pushProjectsChanged();
          await pushTasksChanged();
          return { ok: true, slug };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      createNativeTask: async ({
        project,
        name,
        description,
        tags,
        nativeTool,
        fields,
        outputType,
        outputs,
        browserConfig,
      }) => {
        try {
          const resolvedProject = (await resolveProjectByName(project)) ?? (await addProject(project));
          const { writeNativeTask } = await import("./tasks/writer");
          const slug = await writeNativeTask(
            resolvedProject.path,
            { name, description, project: resolvedProject.name, tags, lifecycle: "draft", version: 1 },
            { fields, outputType, outputs, engine: "native", nativeTool },
            browserConfig ?? { steps: [] },
          );
          await pushProjectsChanged();
          await pushTasksChanged();
          return { ok: true, slug };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      getRunOutputs: async ({ runId }) => {
        const run = getRun(runId);
        if (!run) return [];
        const project = await projectForSlug(run.taskSlug);
        if (!project) return [];
        return await readRunOutputs(project.path, runId);
      },

      // VFS & file locations (ticket 102) -------------------------------------

      listVfsLocations: async ({ project }) => {
        const { listAppLocations, listProjectLocations } = await import("./vfs/registry");
        if (!project) return await listAppLocations();
        const resolved = await pathForProjectName(project);
        if (!resolved) return [];
        const appLocs = await listAppLocations();
        const projLocs = await listProjectLocations(resolved.path);
        return [...appLocs, ...projLocs];
      },

      listAllProjectVfsLocations: async () => {
        const { listAllProjectLocations } = await import("./vfs/registry");
        return await listAllProjectLocations();
      },

      addVfsLocation: async ({ location }) => {
        try {
          const { addLocation } = await import("./vfs/registry");
          await addLocation(location);
          return { ok: true };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      updateVfsLocation: async ({ location }) => {
        try {
          const { updateLocation } = await import("./vfs/registry");
          await updateLocation(location);
          return { ok: true };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      removeVfsLocation: async ({ id, project }) => {
        try {
          const { removeLocation } = await import("./vfs/registry");
          const projectPath = project ? (await pathForProjectName(project))?.path : undefined;
          await removeLocation(id, projectPath);
          return { ok: true };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      vfsList: async ({ locationId, path, project }) => {
        try {
          const { getLocation, getProvider } = await import("./vfs/registry");
          const { LocalProvider } = await import("./vfs/local");
          const projectPath = project ? (await pathForProjectName(project))?.path : undefined;
          const location = await getLocation(locationId, projectPath);
          if (!location) return { entries: [], error: "Location not found" };
          const provider = getProvider(location.provider);
          if (!provider) return { entries: [], error: "Provider not found" };

          let uri: string;
          if (provider instanceof LocalProvider) {
            const root = location.config.root as string;
            uri = provider.pathToUri(path ? join(root, path) : root);
          } else {
            uri = `${location.provider}://${path ?? ""}`;
          }

          const result = await provider.list(uri);
          return result;
        } catch (err) {
          return { entries: [], error: String(err) };
        }
      },

      vfsStat: async ({ locationId, path, project }) => {
        try {
          const { getLocation, getProvider } = await import("./vfs/registry");
          const { LocalProvider } = await import("./vfs/local");
          const projectPath = project ? (await pathForProjectName(project))?.path : undefined;
          const location = await getLocation(locationId, projectPath);
          if (!location) return null;
          const provider = getProvider(location.provider);
          if (!provider) return null;

          let uri: string;
          if (provider instanceof LocalProvider) {
            const root = location.config.root as string;
            uri = provider.pathToUri(join(root, path));
          } else {
            uri = `${location.provider}://${path}`;
          }

          return await provider.stat(uri);
        } catch {
          return null;
        }
      },

      vfsResolveUri: async ({ locationId, path, project }) => {
        try {
          const { getLocation, getProvider } = await import("./vfs/registry");
          const { LocalProvider } = await import("./vfs/local");
          const projectPath = project ? (await pathForProjectName(project))?.path : undefined;
          const location = await getLocation(locationId, projectPath);
          if (!location) return { uri: null };
          const provider = getProvider(location.provider);
          if (!provider) return { uri: null };

          if (provider instanceof LocalProvider) {
            const root = location.config.root as string;
            return { uri: provider.pathToUri(join(root, path)) };
          }
          return { uri: `${location.provider}://${path}` };
        } catch {
          return { uri: null };
        }
      },

      vfsSearch: async ({ locationId, query, project }) => {
        try {
          const { getLocation, getProvider } = await import("./vfs/registry");
          const { LocalProvider } = await import("./vfs/local");
          const projectPath = project ? (await pathForProjectName(project))?.path : undefined;
          const location = await getLocation(locationId, projectPath);
          if (!location) return { paths: [], error: "Location not found" };
          const provider = getProvider(location.provider);
          if (!provider) return { paths: [], error: "Provider not found" };

          let rootUri: string;
          if (provider instanceof LocalProvider) {
            const root = location.config.root as string;
            rootUri = provider.pathToUri(root);
          } else {
            rootUri = `${location.provider}://`;
          }

          return await provider.search(rootUri, query);
        } catch (err) {
          return { paths: [], error: String(err) };
        }
      },

      vfsOpen: async ({ locationId, path, reveal, project }) => {
        try {
          const { getLocation, getProvider } = await import("./vfs/registry");
          const { LocalProvider } = await import("./vfs/local");
          const projectPath = project ? (await pathForProjectName(project))?.path : undefined;
          const location = await getLocation(locationId, projectPath);
          if (!location) return { ok: false, error: "Location not found" };
          const provider = getProvider(location.provider);
          if (!provider) return { ok: false, error: "Provider not found" };

          let uri: string;
          if (provider instanceof LocalProvider) {
            const root = location.config.root as string;
            uri = provider.pathToUri(join(root, path));
          } else {
            uri = `${location.provider}://${path}`;
          }

          return await provider.openNative(uri, reveal);
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      vfsReadPreview: async ({ locationId, path, maxBytes, project }) => {
        try {
          const { getLocation, getProvider, resolveSafe } = await import("./vfs/registry");
          const { LocalProvider } = await import("./vfs/local");
          const projectPath = project ? (await pathForProjectName(project))?.path : undefined;
          const location = await getLocation(locationId, projectPath);
          if (!location) return { base64: "", mime: "", error: "Location not found" };
          const provider = getProvider(location.provider);
          if (!provider) return { base64: "", mime: "", error: "Provider not found" };

          // Security check for local provider
          if (provider instanceof LocalProvider) {
            const safe = await resolveSafe(location, path);
            if (!safe) return { base64: "", mime: "", error: "Path escapes location root" };
          }

          let uri: string;
          if (provider instanceof LocalProvider) {
            const root = location.config.root as string;
            uri = provider.pathToUri(join(root, path));
          } else {
            uri = `${location.provider}://${path}`;
          }

          const result = await provider.read(uri, maxBytes);
          if (result.error) return { base64: "", mime: "", error: result.error };

          return {
            base64: Buffer.from(result.data).toString("base64"),
            mime: result.mime,
          };
        } catch (err) {
          return { base64: "", mime: "", error: String(err) };
        }
      },

      // Ticket 118: run artifacts carry a self-contained URI (e.g.
      // "local:///Users/…") that isn't tied to any registered location, so
      // these dispatch straight to the provider by URI scheme.
      vfsReadByUri: async ({ uri, maxBytes }) => {
        try {
          const { getProvider } = await import("./vfs/registry");
          const scheme = uri.split("://")[0] ?? "";
          const provider = getProvider(scheme);
          if (!provider) return { base64: "", mime: "", error: `No provider for "${scheme}"` };
          const result = await provider.read(uri, maxBytes);
          if (result.error) return { base64: "", mime: "", error: result.error };
          return { base64: Buffer.from(result.data).toString("base64"), mime: result.mime };
        } catch (err) {
          return { base64: "", mime: "", error: String(err) };
        }
      },

      vfsOpenByUri: async ({ uri, reveal }) => {
        try {
          const { getProvider } = await import("./vfs/registry");
          const scheme = uri.split("://")[0] ?? "";
          const provider = getProvider(scheme);
          if (!provider) return { ok: false, error: `No provider for "${scheme}"` };
          return await provider.openNative(uri, reveal);
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      getRunArtifacts: async ({ runId }) => {
        const { getRunArtifacts } = await import("./db/history");
        return getRunArtifacts(runId);
      },

      getDiagnostics: async () => {
        const { gatherDiagnostics } = await import("./diagnostics");
        return await gatherDiagnostics();
      },

      prepareTransparencyReveal: async () => {
        try {
          const { prepareTransparencyReveal } = await import("./transparency");
          const path = await prepareTransparencyReveal();
          return { ok: true, path };
        } catch {
          return { ok: false };
        }
      },

      // Workflows (tickets 88-95) ---------------------------------------------

      listWorkflows: async ({ project }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return [];
        return await storeListWorkflows(resolved.path);
      },

      saveWorkflow: async ({ project, workflow }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return { ok: false, error: "Project not found" };
        const problem = validateForSave(workflow);
        if (problem) return { ok: false, error: problem };
        await storeSaveWorkflow(resolved.path, workflow);
        await refreshWorkflowTriggers(await listProjects());
        return { ok: true };
      },

      deleteWorkflow: async ({ project, id }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return;
        await storeDeleteWorkflow(resolved.path, id);
        await refreshWorkflowTriggers(await listProjects());
      },

      startWorkflowRun: async ({ project, workflowId, params }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return { ok: false, error: "Project not found" };
        const workflow = await getWorkflow(resolved.path, workflowId);
        if (!workflow) return { ok: false, error: "Workflow not found" };
        if (!workflow.enabled) return { ok: false, error: "Workflow is disabled — enable it from the Workflows page." };
        const runId = startWorkflow(
          resolved,
          workflow,
          { type: "manual", params: params ?? {} },
          { params: params ?? {} },
        );
        return { ok: true, runId };
      },

      cancelWorkflowRun: async ({ runId }) => {
        engineCancelRun(runId);
      },

      listWorkflowRuns: async ({ project, workflowId }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return [];
        return await listWorkflowRunFiles(resolved.path, workflowId);
      },

      getWorkflowRun: async ({ project, runId }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return null;
        return await getWorkflowRunFile(resolved.path, runId);
      },

      dryRunWorkflow: async ({ project, workflowId, params }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return { ok: false, error: "Project not found" };
        const workflow = await getWorkflow(resolved.path, workflowId);
        if (!workflow) return { ok: false, error: "Workflow not found" };
        try {
          const { plan, problems } = await engineDryRun(resolved.path, resolved.name, workflow, params ?? {});
          return { ok: true, plan, problems };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      replayWorkflowStep: async ({ project, runId, recordIndex }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return { ok: false, error: "Project not found" };
        const run = await getWorkflowRunFile(resolved.path, runId);
        if (!run) return { ok: false, error: "Run not found" };
        return await engineReplayStep(resolved.path, resolved.name, run, recordIndex);
      },

      draftWorkflow: async ({ project, goal, name, serviceId, model }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return { ok: false, error: "Project not found" };
        const service = await getAIService(serviceId);
        if (!service) return { ok: false, error: "Selected AI service not found." };
        const tasks = (await listTasks()).filter((f) => f.meta.project === resolved.name);
        if (tasks.length === 0) return { ok: false, error: "This project has no tasks yet — create one first." };
        try {
          const { workflow, notes } = await draftWorkflow(goal, name, tasks, service, model, resolved.path, resolved.name);
          return { ok: true, workflow, notes };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      duplicateWorkflow: async ({ project, id }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return { ok: false, error: "Project not found" };
        try {
          const dup = await storeDuplicateWorkflow(resolved.path, id);
          if (!dup) return { ok: false, error: "Workflow not found" };
          // Refresh triggers so the new (disabled) workflow is known; list refresh happens in client.
          await refreshWorkflowTriggers(await listProjects());
          return { ok: true, workflow: dup };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      // Reports (ticket 134) ---------------------------------------------------

      listReports: async ({ project }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return [];
        return await storeListReports(resolved.path);
      },

      saveReport: async ({ project, report }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return { ok: false, error: "Project not found" };
        const problem = validateReportForSave(report);
        if (problem) return { ok: false, error: problem };
        await storeSaveReport(resolved.path, report);
        return { ok: true };
      },

      deleteReport: async ({ project, id }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return;
        await storeDeleteReport(resolved.path, id);
      },

      exportReportMarkdown: async ({ project, id }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return { ok: false, error: "Project not found" };
        const report = await getReport(resolved.path, id);
        if (!report) return { ok: false, error: "Report not found" };
        try {
          const path = await exportReportToFile(resolved.path, resolved.name, report);
          return { ok: true, path };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      getScheduledWorkflows: async ({ project }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return [];
        return await getScheduledWorkflows(resolved.path);
      },

      scheduleWorkflowRun: async ({ project, workflowId, workflowName, params, scheduledAt, repeatInterval }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return { ok: false, error: "Project not found" };
        try {
          const id = await scheduleWorkflowRun(
            resolved.path,
            resolved.name,
            workflowId,
            workflowName,
            params,
            scheduledAt,
            repeatInterval,
          );
          return { ok: true, id };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      rescheduleWorkflowRun: async ({ project, id, scheduledAt, repeatInterval }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return { ok: false };
        const ok = await rescheduleWorkflowRunSchedule(resolved.path, resolved.name, id, scheduledAt, repeatInterval);
        return { ok };
      },

      cancelScheduledWorkflowRun: async ({ project, id }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return;
        await cancelScheduledWorkflowRun(resolved.path, id);
      },

      deleteScheduledWorkflowOccurrence: async ({ project, id, occurrenceAt }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return { ok: false };
        const ok = await deleteWorkflowOccurrence(resolved.path, resolved.name, id, occurrenceAt);
        return { ok };
      },

      runScheduledWorkflowRunNow: async ({ project, id }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return { ok: false };
        const ok = await runScheduledWorkflowRunNow(resolved.path, resolved.name, id);
        return { ok };
      },

      setPinned: ({ runId, pinned }) => {
        setPinned(runId, pinned);
      },

      deleteRun: ({ runId }) => {
        // A pending scheduled run has a live timer — deleting it without
        // clearing that timer left it firing later and recreating itself.
        if (getRun(runId)?.status === "scheduled") cancelScheduled(runId);
        else dbDeleteRun(runId);
      },

      markRunsRead: ({ runIds }) => {
        const { markRunsRead } = require("./db/history");
        markRunsRead(runIds);
      },

      markWorkflowRunsRead: async ({ project, runIds }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return;
        const { markWorkflowRunsRead } = await import("./workflows/runStore");
        await markWorkflowRunsRead(resolved.path, runIds);
      },

      scheduleRun: async ({ taskSlug, inputs, scheduledAt, repeatInterval }) => {
        const project = await projectForSlug(taskSlug);
        if (!project) throw new Error(`Task not found: ${taskSlug}`);
        const runId = await schedule(project.path, taskSlug, inputs, scheduledAt, repeatInterval);
        return { runId };
      },

      updateScheduledRun: async ({ runId, scheduledAt, repeatInterval }) => {
        return { ok: rescheduleRun(runId, scheduledAt, repeatInterval) };
      },

      runScheduledNow: async ({ runId }) => {
        return { ok: runScheduledNow(runId) };
      },

      deleteOccurrence: async ({ runId, occurrenceAt }) => {
        return { ok: deleteOccurrence(runId, occurrenceAt) };
      },

      getLayout: async ({ projectSlug }) => {
        const project = await pathForProjectName(projectSlug);
        if (!project) return { cards: [] };
        return await readLayout(project.path, projectSlug);
      },

      saveLayout: async ({ projectSlug, layout }) => {
        const project = await pathForProjectName(projectSlug);
        if (!project) return;
        await writeLayout(project.path, projectSlug, layout);
      },

      getViews: async ({ project }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return [];
        return await readViews(resolved.path);
      },

      saveViews: async ({ project, views }) => {
        const resolved = await pathForProjectName(project);
        if (!resolved) return;
        await writeViews(resolved.path, views);
      },

      suggestViewName: async ({ filterSummary, sampleRuns }) => {
        try {
          const name = await generateViewName(filterSummary, sampleRuns);
          return name ? { ok: true, name } : { ok: false };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      getUIState: async () => await readUIState(),

      saveUIState: async (state) => {
        // Merge rather than overwrite (ticket 138): the companion window's
        // enabled/muted/position fields are written by its own dedicated
        // handlers and never round-trip through the renderer's UIState
        // payload, so a blind overwrite here would silently drop them.
        const current = await readUIState();
        await writeUIState({ ...current, ...state });
      },

      listStarterTasks: async () => listStarterTasks(),

      installStarterTasks: async ({ projectName, slugs }) => await installStarterTasks(projectName, slugs),

      listStarterWorkflows: async () => listStarterWorkflows(),

      installStarterWorkflows: async ({ projectName, ids }) => await installStarterWorkflows(projectName, ids),

      chooseDirectory: async ({ startingFolder }) => {
        const paths = await Utils.openFileDialog({
          startingFolder: startingFolder ?? "~/",
          canChooseDirectory: true,
          canChooseFiles: false,
          allowsMultipleSelection: false,
        });
        const path = paths?.[0] ?? null;
        return path;
      },

      // Ticket 130: Electrobun's native dialog has no can-create-directories
      // option, so the picker flow falls back to mkdir-ing a named subfolder
      // of an already-picked parent.
      createDirectory: async ({ parent, name }) => {
        const trimmed = name.trim();
        if (!trimmed) return { ok: false, error: "Name required" };
        if (trimmed.includes("/") || trimmed.includes("\\") || trimmed === "." || trimmed === "..") {
          return { ok: false, error: "Invalid folder name" };
        }
        const path = join(parent, trimmed);
        if (existsSync(path)) {
          return { ok: false, error: "That already exists" };
        }
        try {
          ensureDir(path);
          return { ok: true, path };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      openFolder: async ({ path }) => {
        const ok = Utils.openPath(path);
        return { ok };
      },

      deleteTask: async ({ projectPath, slug }) => {
        try {
          const dir = formDir(projectPath, slug);
          const base = projectFormsDir(projectPath);
          if (!resolve(dir).startsWith(resolve(base) + sep)) {
            return { ok: false, error: "Invalid task path" };
          }
          rmSync(dir, { recursive: true, force: true });
          await pushTasksChanged();
          return { ok: true };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      updateTaskMeta: async ({ projectPath, slug, patch }) => {
        try {
          const dir = formDir(projectPath, slug);
          const base = projectFormsDir(projectPath);
          if (!resolve(dir).startsWith(resolve(base) + sep)) {
            return { ok: false, error: "Invalid task path" };
          }
          if (patch.name !== undefined && patch.name.trim() === "") {
            return { ok: false, error: "Name required" };
          }
          const metaPath = join(dir, "meta.json");
          const file = Bun.file(metaPath);
          if (!(await file.exists())) {
            return { ok: false, error: "Task not found" };
          }
          const raw = JSON.parse(await file.text()) as Record<string, unknown>;
          const next = {
            ...raw,
            ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
            ...(patch.description !== undefined ? { description: patch.description } : {}),
            ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
            // Slug is identity across runs/history — never patched.
            slug: typeof raw.slug === "string" ? raw.slug : slug,
            updatedAt: new Date().toISOString(),
          };
          await Bun.write(metaPath, JSON.stringify(next, null, 2));
          await pushTasksChanged();
          return { ok: true };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      // Task adoption & versioning (ticket 105) -------------------------------

      adoptTask: async ({ projectPath, slug }) => {
        try {
          const projects = await listProjects();
          const project = projects.find((p) => p.path === projectPath);
          if (!project) return { ok: false, error: "Project not found" };
          const folder = await loadTaskFolder(projectPath, slug, project.name);
          if (!folder) return { ok: false, error: "Task not found" };
          const { adoptTask } = await import("./tasks/writer");
          const adopted = await adoptTask(projectPath, slug, folder.meta);
          if (!adopted) return { ok: false, error: "Task is already adopted" };
          await pushTasksChanged();
          return { ok: true };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      saveTaskVersion: async ({ projectPath, slug, meta, task }) => {
        try {
          const projects = await listProjects();
          const project = projects.find((p) => p.path === projectPath);
          if (!project) return { ok: false, error: "Project not found" };
          const folder = await loadTaskFolder(projectPath, slug, project.name);
          if (!folder) return { ok: false, error: "Task not found" };
          const { saveTaskVersion } = await import("./tasks/writer");
          const newVersion = await saveTaskVersion(
            projectPath,
            slug,
            folder.meta.version,
            meta,
            task,
            folder.meta.createdAt,
          );
          await pushTasksChanged();
          return { ok: true, version: newVersion };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      listTaskVersions: async ({ projectPath, slug }) => {
        try {
          const { listTaskVersions } = await import("./tasks/loader");
          const versions = await listTaskVersions(projectPath, slug);
          return { ok: true, versions };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      loadTaskVersion: async ({ projectPath, slug, version }) => {
        try {
          const projects = await listProjects();
          const project = projects.find((p) => p.path === projectPath);
          if (!project) return { ok: false, error: "Project not found" };
          const { loadTaskVersion } = await import("./tasks/loader");
          const folder = await loadTaskVersion(projectPath, slug, version, project.name);
          if (!folder) return { ok: false, error: "Version not found" };
          return { ok: true, folder };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      rollbackTaskVersion: async ({ projectPath, slug, version }) => {
        try {
          const projects = await listProjects();
          const project = projects.find((p) => p.path === projectPath);
          if (!project) return { ok: false, error: "Project not found" };
          const { loadTaskVersion } = await import("./tasks/loader");
          const { saveTaskVersion } = await import("./tasks/writer");
          const oldFolder = await loadTaskVersion(projectPath, slug, version, project.name);
          if (!oldFolder) return { ok: false, error: "Version not found" };
          const currentFolder = await loadTaskFolder(projectPath, slug, project.name);
          if (!currentFolder) return { ok: false, error: "Task not found" };
          // Create a new version from the old one's definition
          const newVersion = await saveTaskVersion(
            projectPath,
            slug,
            currentFolder.meta.version,
            {
              name: oldFolder.meta.name,
              description: oldFolder.meta.description,
              tags: oldFolder.meta.tags,
              project: oldFolder.meta.project,
              interpreter: oldFolder.meta.interpreter,
              aiProvider: oldFolder.meta.aiProvider,
              aiModel: oldFolder.meta.aiModel,
              lifecycle: oldFolder.meta.lifecycle,
              version: oldFolder.meta.version,
            },
            oldFolder.task,
            currentFolder.meta.createdAt,
          );
          await pushTasksChanged();
          return { ok: true, newVersion };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      getWorkflowsReferencingTask: async ({ projectPath, slug }) => {
        try {
          const { getWorkflowsReferencingTask } = await import("./workflows/store");
          const workflows = await getWorkflowsReferencingTask(projectPath, slug);
          return { workflows };
        } catch (err) {
          return { workflows: [] };
        }
      },

      upgradeWorkflowTaskVersion: async ({ projectPath, workflowId, stepNames, newVersion }) => {
        try {
          const { upgradeWorkflowTaskVersion } = await import("./workflows/store");
          await upgradeWorkflowTaskVersion(projectPath, workflowId, stepNames, newVersion);
          return { ok: true };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      // Native browser automation (ticket 99 slice 2) ------------------------
      saveBrowserConfig: async ({ projectPath, slug, config }) => {
        try {
          const { saveBrowserConfig } = await import("./tasks/writer");
          await saveBrowserConfig(projectPath, slug, config);
          await pushTasksChanged();
          return { ok: true };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      runBrowserStep: async ({ projectPath, slug, stepId, inputs }) => {
        try {
          const projects = await listProjects();
          const project = projects.find((p) => p.path === projectPath);
          if (!project) return { ok: false, error: "Project not found" };
          const folder = await loadTaskFolder(projectPath, slug, project.name);
          if (!folder) return { ok: false, error: "Task not found" };
          const config = folder.native?.browser;
          if (!config) return { ok: false, error: "No browser configuration" };
          const step = config.steps.find((s) => s.id === stepId);
          if (!step) return { ok: false, error: "Step not found" };

          const { runSingleBrowserStep } = await import("./runner/browserRun");
          const trace = await runSingleBrowserStep(folder, inputs, step);
          return { ok: true, trace };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      startBrowserRecording: async ({ url }) => {
        try {
          const { startRecording } = await import("./browser/recorder");
          return await startRecording(url);
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      stopBrowserRecording: async ({ recordingId }) => {
        try {
          const { stopRecording } = await import("./browser/recorder");
          return await stopRecording(recordingId);
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      // Voice companion (ticket 138) -------------------------------------------
      initCompanion: async () => {
        const ui = await readUIState();
        const enabled = ui.companionEnabled !== false;
        // Guards React StrictMode's double-invoked mount effect in dev — the
        // window still gets (re-)shown either way, it just won't re-greet.
        const shouldGreet = enabled && !companionGreetedThisSession;
        if (enabled) {
          await ensureCompanionWindow();
          companionGreetedThisSession = true;
        }
        return { shouldGreet, greeting: COMPANION_GREETING };
      },

      showCompanion: async () => {
        await showCompanionWindow();
      },

      hideCompanion: async () => {
        await hideCompanionWindow();
      },

      setCompanionMuted: async ({ muted }) => {
        await setCompanionMutedState(muted);
      },

      relayCompanionSpeechPhase: async (event) => {
        sendToCompanion("onCompanionSpeechPhase", event);
      },

      relayCompanionTranscriptLine: async (line) => {
        sendToCompanion("onCompanionTranscriptLine", line);
      },

      relayCompanionListening: async ({ listening }) => {
        sendToCompanion("onCompanionListening", { listening });
      },
    },
    messages: {
      logToBun: ({ msg, type }) => {
        switch (type) {
          case "info":
            console.info(`[view] ${msg}`);
            break;
          case "warn":
            console.warn(`[view] ${msg}`);
            break;
          case "error":
            console.error(`[view] ${msg}`);
            break;
          case "debug":
            console.debug(`[view] ${msg}`);
            break;
          default:
            console.log(`[view] ${msg}`);
        }
      },
    },
  },
});

// ---------------------------------------------------------------------------
// Scheduler — auto-runs scheduled tasks (including overdue ones on launch).
// ---------------------------------------------------------------------------
await initScheduler((projectPath, runId, taskSlug, inputs) => {
  void (async () => {
    const projects = await listProjects();
    const name = projects.find((p) => p.path === projectPath)?.name ?? projectPath;
    void startRun(projectPath, name, taskSlug, inputs, emitters, runId);
  })();
});

// Calendar-scheduled workflow runs (ticket 117) — same launch-time arming as
// the task scheduler above, firing through the workflow engine instead.
await initWorkflowSchedules(await listProjects(), (projectPath, projectName, workflowId, trigger) => {
  void (async () => {
    const workflow = await getWorkflow(projectPath, workflowId);
    if (!workflow || !workflow.enabled) return;
    startWorkflow({ path: projectPath, name: projectName }, workflow, trigger, { params: trigger.params ?? {} });
  })();
});

// ---------------------------------------------------------------------------
// Window.
// ---------------------------------------------------------------------------
async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      const url = `${DEV_SERVER_URL}/mainview/index.html`;
      await fetch(url, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return url;
    } catch {
      console.log("Vite dev server not running. Run 'bun run dev:hmr' for HMR support.");
    }
  }
  return "views://mainview/index.html";
}

ApplicationMenu.setApplicationMenu([
  {
    label: "CLIDE",
    submenu: [{ label: "About CLIDE", role: "showHelp" }, { type: "separator" }, { label: "Quit CLIDE", role: "quit" }],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  },
  // Surface jumps + run picker, mirroring the renderer's keyboard shortcuts
  // (ticket 70) so users can discover them from the menu bar.
  {
    label: "View",
    submenu: [
      { label: "Tasks", action: "view:tasks", accelerator: "CommandOrControl+P" },
      { label: "Calendar", action: "view:calendar", accelerator: "CommandOrControl+Shift+C" },
      { label: "Views", action: "view:views", accelerator: "CommandOrControl+Shift+V" },
      { label: "Workflows", action: "view:workflows", accelerator: "CommandOrControl+Shift+U" },
      { label: "Project Settings", action: "view:project-settings", accelerator: "CommandOrControl+," },
      { type: "separator" },
      { label: "Run a Task…", action: "view:run-picker", accelerator: "CommandOrControl+K" },
      { type: "separator" },
      // Browser-style view tab navigation (tickets 43, 83, 84).
      { label: "New Tab", action: "view:new-tab", accelerator: "CommandOrControl+T" },
      { label: "Close Tab", action: "view:close-tab", accelerator: "CommandOrControl+W" },
      { label: "Next Tab", action: "view:next-tab", accelerator: "Ctrl+Tab" },
      { label: "Previous Tab", action: "view:prev-tab", accelerator: "Ctrl+Shift+Tab" },
    ],
  },
]);

// Forward View-menu clicks to the renderer, which owns surface state. The
// renderer dedupes against its own keydown handler in case a platform
// delivers both the menu accelerator and the webview key event.
ApplicationMenu.on("application-menu-clicked", (event) => {
  const action = (event as { data?: { action?: string } })?.data?.action;
  if (typeof action === "string" && action.startsWith("view:")) {
    sendToView("onMenuAction", { action });
  }
});

const url = await getMainViewUrl();

mainWindow = new BrowserWindow({
  title: "CLIDE",
  url,
  frame: {
    width: 1200,
    height: 720,
    x: 200,
    y: 120,
  },
  titleBarStyle: "hidden",
  transparent: true,
  rpc,
});

// Watch each project's tasks directory and push changes to the renderer live.
const stopWatching = watchTasks(await projectPaths(), () => {
  void pushTasksChanged();
});

mainWindow.on("close", () => {
  stopWatching();
  disposeScheduler();
  disposeWorkflowTriggers();
  disposeWorkflowSchedules();
  if (companionMoveDebounce) clearTimeout(companionMoveDebounce);
  companionWindow?.close();
});

console.log("CLIDE started.");
