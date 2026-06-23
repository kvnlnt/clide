import {
  ApplicationMenu,
  BrowserView,
  BrowserWindow,
  Updater,
  Utils,
} from "electrobun/bun";
import { extname, join } from "node:path";
import type {
  ClideRPC,
  OutputChunk,
  Project,
  RunStatusUpdate,
} from "../shared/types";
import {
  loadAISettings,
  saveAISettings as persistAISettings,
} from "./ai/aiSettings";
import { hasCredential, saveCredential } from "./ai/credentials";
import { generateForm, runDependencyCheck } from "./ai/formGenerator";
import {
  addProject,
  listProjects,
  loadProjects,
  projectPaths,
  removeProject,
  renameProject,
  resolveProjectByName,
} from "./config";
import {
  deleteRun as dbDeleteRun,
  getAllRuns,
  getRun,
  getRunHistory,
  indexRuns,
  setPinned,
} from "./db/history";
import { readLayout, writeLayout } from "./forms/layout";
import { listForms, loadFormFolder, resolveFormProject } from "./forms/loader";
import { seedExampleProjects } from "./forms/seed";
import { watchForms } from "./forms/watcher";
import { writeForm } from "./forms/writer";
import { formDir } from "./paths";
import { cancelRun, startRun, type RunEmitters } from "./runner/execute";
import { disposeScheduler, initScheduler, schedule } from "./scheduler";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// ---------------------------------------------------------------------------
// Bootstrap on-disk state. Projects are folders on disk; seed example projects
// on first launch, then index existing run history.
// ---------------------------------------------------------------------------
await loadProjects();
await seedExampleProjects();
indexRuns(await projectPaths());

/** Resolve a project name to its folder path. */
async function pathForProjectName(name: string): Promise<Project | null> {
  return resolveProjectByName(name);
}

/** Resolve the project a form slug belongs to (path + display name). */
async function projectForSlug(slug: string): Promise<Project | null> {
  const path = resolveFormProject(slug);
  if (!path) {
    // Index may be stale (e.g. file added externally) — refresh and retry.
    await listForms();
  }
  const resolved = resolveFormProject(slug);
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

function sendToView(name: string, payload: unknown): void {
  try {
    const send = (
      mainWindow?.webview?.rpc as
        | { send?: Record<string, (p: unknown) => void> }
        | undefined
    )?.send;
    send?.[name]?.(payload);
  } catch (err) {
    console.warn(`[rpc] Failed to send ${name}:`, err);
  }
}

const emitters: RunEmitters = {
  emitChunk: (chunk: OutputChunk) => sendToView("onOutputChunk", chunk),
  emitStatus: (update: RunStatusUpdate) => sendToView("onRunStatus", update),
};

async function pushFormsChanged(): Promise<void> {
  const forms = await listForms();
  sendToView("onFormsChanged", { forms });
}

async function pushProjectsChanged(): Promise<void> {
  const projects = await listProjects();
  sendToView("onProjectsChanged", { projects });
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

async function readOutputFile(
  runId: string,
): Promise<{ mime: string; base64: string } | null> {
  const run = getRun(runId);
  if (!run || !run.outputPath) return null;
  const project = await projectForSlug(run.formSlug);
  const folder = project
    ? await loadFormFolder(project.path, run.formSlug, project.name)
    : null;
  const outputType = folder?.form.outputType ?? "text";

  try {
    if (
      outputType === "image" ||
      outputType === "audio" ||
      outputType === "video"
    ) {
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

async function readFormScript(
  formSlug: string,
): Promise<{ script: string; extension: string } | null> {
  const project = await projectForSlug(formSlug);
  if (!project) return null;
  const folder = await loadFormFolder(project.path, formSlug, project.name);
  if (!folder) return null;
  try {
    const scriptPath = join(
      formDir(project.path, formSlug),
      folder.form.scriptFile,
    );
    const script = await Bun.file(scriptPath).text();
    const extension = extname(folder.form.scriptFile).replace(/^\./, "");
    return { script, extension };
  } catch {
    return null;
  }
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
          await pushFormsChanged();
          return { ok: true, project };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      removeProject: async ({ path, deleteFiles }) => {
        await removeProject(path, deleteFiles === true);
        await pushProjectsChanged();
        await pushFormsChanged();
      },

      listForms: async () => await listForms(),

      getRunHistory: async ({ formSlug, limit }) => {
        const project = await projectForSlug(formSlug);
        if (!project) return [];
        return getRunHistory(project.path, formSlug, limit);
      },

      getAllRuns: async ({ project }) => {
        if (project === null) return getAllRuns(await projectPaths());
        const resolved = await pathForProjectName(project);
        if (!resolved) return [];
        return getAllRuns([resolved.path]);
      },

      runForm: async ({ formSlug, inputs }) => {
        const project = await projectForSlug(formSlug);
        if (!project) throw new Error(`Form not found: ${formSlug}`);
        return await startRun(
          project.path,
          project.name,
          formSlug,
          inputs,
          emitters,
        );
      },

      cancelRun: ({ runId }) => {
        cancelRun(runId, emitters);
      },

      readOutputFile: async ({ runId }) => await readOutputFile(runId),

      getFormScript: async ({ formSlug }) => await readFormScript(formSlug),

      saveCredentials: async ({ provider, key }) => {
        await saveCredential(provider, key);
      },

      hasCredentials: async ({ provider }) => await hasCredential(provider),

      createForm: async (input) => {
        try {
          if (!(await hasCredential(input.provider))) {
            return {
              ok: false,
              error: `No credentials saved for ${input.provider}.`,
            };
          }
          // Resolve (or create) the destination project folder.
          const project =
            (await resolveProjectByName(input.project)) ??
            (await addProject(input.project));
          const generated = await generateForm(input);
          const missing = await runDependencyCheck(generated);
          if (missing) {
            return {
              ok: false,
              dependencyMissing: missing,
              installInstructions: generated.installInstructions,
              error: `Missing dependency: ${missing}`,
            };
          }
          const slug = await writeForm(project.path, generated);
          await pushProjectsChanged();
          await pushFormsChanged();
          return { ok: true, slug };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      setPinned: ({ runId, pinned }) => {
        setPinned(runId, pinned);
      },

      deleteRun: ({ runId }) => {
        dbDeleteRun(runId);
      },

      scheduleRun: async ({
        formSlug,
        inputs,
        scheduledAt,
        repeatInterval,
      }) => {
        const project = await projectForSlug(formSlug);
        if (!project) throw new Error(`Form not found: ${formSlug}`);
        const runId = schedule(
          project.path,
          formSlug,
          inputs,
          scheduledAt,
          repeatInterval,
        );
        return { runId };
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

      getAISettings: async () => await loadAISettings(),

      saveAISettings: async (settings) => {
        await persistAISettings(settings);
      },

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

      openFolder: async ({ path }) => {
        const ok = Utils.openPath(path);
        return { ok };
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
// Scheduler — auto-runs scheduled forms (including overdue ones on launch).
// ---------------------------------------------------------------------------
await initScheduler((projectPath, runId, formSlug, inputs) => {
  void (async () => {
    const projects = await listProjects();
    const name =
      projects.find((p) => p.path === projectPath)?.name ?? projectPath;
    void startRun(projectPath, name, formSlug, inputs, emitters, runId);
  })();
});

// ---------------------------------------------------------------------------
// Window.
// ---------------------------------------------------------------------------
async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log(
        "Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
      );
    }
  }
  return "views://mainview/index.html";
}

ApplicationMenu.setApplicationMenu([
  {
    label: "CLIDE",
    submenu: [
      { label: "About CLIDE", role: "showHelp" },
      { type: "separator" },
      { label: "Quit CLIDE", role: "quit" },
    ],
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
]);

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

// Watch each project's forms directory and push changes to the renderer live.
const stopWatching = watchForms(await projectPaths(), () => {
  void pushFormsChanged();
});

mainWindow.on("close", () => {
  stopWatching();
  disposeScheduler();
});

console.log("CLIDE started.");
