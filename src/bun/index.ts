import { ApplicationMenu, BrowserView, BrowserWindow, Updater, Utils } from "electrobun/bun";
import { rmSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import type { ClideRPC, OutputChunk, Project, RunStatusUpdate, ToolRegistryEntry, ToolSource } from "../shared/types";
import { getAIService, listAIServices, listServiceModels, saveAIServices, testAIService } from "./ai/aiServices";
import { hasCredential, saveCredential } from "./ai/credentials";
import { draftFormSpec, generateForm, generateFormFromSpec, runDependencyCheck } from "./ai/formGenerator";
import { fillMagicFields } from "./ai/magicFill";
import { draftCommandFields } from "./ai/commandFields";
import { distillToolSpec, suggestTools } from "./ai/toolSpec";
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
import { rebuildListenerIndex, registerHop, resolvePayloadMapping, setAutoSubmitHandler } from "./events/bus";
import { readLayout, writeLayout } from "./forms/layout";
import { listForms, loadFormFolder, resolveFormProject } from "./forms/loader";
import { readViews, writeViews } from "./forms/views";
import { watchForms } from "./forms/watcher";
import { writeCommandForm, writeForm } from "./forms/writer";
import { formDir, projectFormsDir } from "./paths";
import { cancelRun, startRun, type RunEmitters } from "./runner/execute";
import { cancelScheduled, disposeScheduler, initScheduler, rescheduleRun, runScheduledNow, schedule } from "./scheduler";
import { captureFingerprint, captureHelp, resolveTool as resolveToolPath } from "./tools/inspect";
import {
  findByRealPath,
  getTool,
  listTools as listRegisteredTools,
  registerBinaryBytes,
  removeTool,
  saveTool,
} from "./tools/registry";
import { readUIState, writeUIState } from "./uiState";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// ---------------------------------------------------------------------------
// Bootstrap on-disk state. Projects are folders on disk; a genuinely empty
// registry is now a real, reachable state — the first-project takeover
// (ticket 78) owns that experience, so we no longer auto-seed demo projects
// on top of it (see forms/seed.ts, kept for dev-profile fixtures, ticket 79).
// ---------------------------------------------------------------------------
await loadProjects();
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
    const send = (mainWindow?.webview?.rpc as { send?: Record<string, (p: unknown) => void> } | undefined)?.send;
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
  rebuildListenerIndex(forms);
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

async function readOutputFile(runId: string): Promise<{ mime: string; base64: string } | null> {
  const run = getRun(runId);
  if (!run || !run.outputPath) return null;
  const project = await projectForSlug(run.formSlug);
  const folder = project ? await loadFormFolder(project.path, run.formSlug, project.name) : null;
  const outputType = folder?.form.outputType ?? "text";

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

async function readFormScript(formSlug: string): Promise<{ script: string; extension: string } | null> {
  const project = await projectForSlug(formSlug);
  if (!project) return null;
  const folder = await loadFormFolder(project.path, formSlug, project.name);
  if (!folder?.form.scriptFile) return null;
  try {
    const scriptPath = join(formDir(project.path, formSlug), folder.form.scriptFile);
    const script = await Bun.file(scriptPath).text();
    const extension = extname(folder.form.scriptFile).replace(/^\./, "");
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
        return await startRun(project.path, project.name, formSlug, inputs, emitters);
      },

      cancelRun: ({ runId }) => {
        cancelRun(runId, emitters);
      },

      readOutputFile: async ({ runId }) => await readOutputFile(runId),

      getFormScript: async ({ formSlug }) => await readFormScript(formSlug),

      saveServiceCredential: async ({ serviceId, key }) => {
        await saveCredential(serviceId, key);
      },

      hasServiceCredential: async ({ serviceId }) => await hasCredential(serviceId),

      listAIServices: async () => await listAIServices(),

      saveAIServices: async ({ services }) => {
        await saveAIServices(services);
      },

      testAIService: async ({ serviceId }) => await testAIService(serviceId),

      createForm: async (input) => {
        try {
          const service = await getAIService(input.serviceId);
          if (!service) {
            return { ok: false, error: "Selected AI service not found." };
          }
          if ((service.kind === "anthropic" || service.kind === "openai") && !(await hasCredential(service.id))) {
            return { ok: false, error: `No API key saved for "${service.name}".` };
          }
          // Resolve (or create) the destination project folder.
          const project = (await resolveProjectByName(input.project)) ?? (await addProject(input.project));
          const generated = input.spec ? await generateFormFromSpec(input, input.spec) : await generateForm(input);
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

      draftFormSpec: async (input) => {
        try {
          const service = await getAIService(input.serviceId);
          if (!service) {
            return { ok: false, error: "Selected AI service not found." };
          }
          if ((service.kind === "anthropic" || service.kind === "openai") && !(await hasCredential(service.id))) {
            return { ok: false, error: `No API key saved for "${service.name}".` };
          }
          const spec = await draftFormSpec(input);
          return { ok: true, spec };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      fillMagicFields: async ({ formSlug, fields, payload }) => {
        try {
          const project = await projectForSlug(formSlug);
          if (!project) return { ok: false, error: `Form not found: ${formSlug}` };
          const folder = await loadFormFolder(project.path, formSlug, project.name);
          if (!folder) return { ok: false, error: `Form not found: ${formSlug}` };
          const values = await fillMagicFields(folder, fields, payload);
          return { ok: true, values };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      listTools: async () => await listRegisteredTools(),

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

      draftCommandFields: async ({ goal, toolName, actionName, spec, serviceId, model }) => {
        const service = await getAIService(serviceId);
        if (!service) return { ok: false, error: "Selected AI service not found." };
        try {
          const fields = await draftCommandFields(goal, toolName, actionName, spec, service, model);
          return { ok: true, fields };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      createCommandForm: async ({ project, name, description, tags, command, fields, outputType, outputs, events }) => {
        try {
          const resolvedProject = (await resolveProjectByName(project)) ?? (await addProject(project));
          const slug = await writeCommandForm(
            resolvedProject.path,
            { name, description, project: resolvedProject.name, tags },
            { fields, outputType, outputs, events, command },
          );
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
        // A pending scheduled run has a live timer — deleting it without
        // clearing that timer left it firing later and recreating itself.
        if (getRun(runId)?.status === "scheduled") cancelScheduled(runId);
        else dbDeleteRun(runId);
      },

      scheduleRun: async ({ formSlug, inputs, scheduledAt, repeatInterval }) => {
        const project = await projectForSlug(formSlug);
        if (!project) throw new Error(`Form not found: ${formSlug}`);
        const runId = schedule(project.path, formSlug, inputs, scheduledAt, repeatInterval);
        return { runId };
      },

      updateScheduledRun: async ({ runId, scheduledAt, repeatInterval }) => {
        return { ok: rescheduleRun(runId, scheduledAt, repeatInterval) };
      },

      runScheduledNow: async ({ runId }) => {
        return { ok: runScheduledNow(runId) };
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

      getUIState: async () => await readUIState(),

      saveUIState: async (state) => {
        await writeUIState(state);
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

      deleteForm: async ({ projectPath, slug }) => {
        try {
          const dir = formDir(projectPath, slug);
          const base = projectFormsDir(projectPath);
          if (!resolve(dir).startsWith(resolve(base) + sep)) {
            return { ok: false, error: "Invalid form path" };
          }
          rmSync(dir, { recursive: true, force: true });
          await pushFormsChanged();
          return { ok: true };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },

      updateFormMeta: async ({ projectPath, slug, patch }) => {
        try {
          const dir = formDir(projectPath, slug);
          const base = projectFormsDir(projectPath);
          if (!resolve(dir).startsWith(resolve(base) + sep)) {
            return { ok: false, error: "Invalid form path" };
          }
          if (patch.name !== undefined && patch.name.trim() === "") {
            return { ok: false, error: "Name required" };
          }
          const metaPath = join(dir, "meta.json");
          const file = Bun.file(metaPath);
          if (!(await file.exists())) {
            return { ok: false, error: "Form not found" };
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
          await pushFormsChanged();
          return { ok: true };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
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
    const name = projects.find((p) => p.path === projectPath)?.name ?? projectPath;
    void startRun(projectPath, name, formSlug, inputs, emitters, runId);
  })();
});

// ---------------------------------------------------------------------------
// Event bus — auto-submit forms listening for events emitted by finished runs.
// ---------------------------------------------------------------------------
rebuildListenerIndex(await listForms());

setAutoSubmitHandler((event, target) => {
  void (async () => {
    try {
      const folder = await loadFormFolder(target.projectPath, target.slug, target.projectName);
      const fields = folder?.form.fields ?? [];

      // Deterministic payload → field mapping (ticket 56) fills first, with no
      // AI call — a mapping that resolves to nothing is left empty/visible
      // rather than falling back to AI for that field. Fields without a
      // mapping (or "prompt"-sourced magic) go through AI magic fill (ticket 24)
      // as before. Failure of either path never blocks submission.
      const inputs: Record<string, unknown> = {};
      const aiMagicFields: Record<string, string> = {};
      for (const field of fields) {
        const magic = field.magic;
        if (!magic?.prompt) continue;
        if (magic.source === "event" && magic.payloadMapping) {
          const value = resolvePayloadMapping(magic.payloadMapping, event);
          if (value !== undefined && value !== null && value !== "") inputs[field.id] = value;
          continue;
        }
        aiMagicFields[field.id] = magic.prompt;
      }

      let fillError: string | null = null;
      if (folder && Object.keys(aiMagicFields).length > 0) {
        try {
          Object.assign(inputs, await fillMagicFields(folder, aiMagicFields, event.payload));
        } catch (err) {
          fillError = String(err);
        }
      }

      // Pre-generate the run id so the hop depth is recorded before execution.
      const runId = crypto.randomUUID();
      registerHop(runId, event.sourceRunId);
      await startRun(target.projectPath, target.projectName, target.slug, inputs, emitters, runId, {
        event: event.name,
        sourceRunId: event.sourceRunId,
        artifacts: event.payload.artifacts,
      });
      if (fillError) {
        emitters.emitChunk({
          runId,
          type: "stderr",
          data: `Magic fill failed — submitted with empty values: ${fillError}`,
          timestamp: Date.now(),
        });
      }
      console.log(`[bus] "${event.name}" from ${event.sourceFormSlug} → auto-submitted ${target.slug} (${runId})`);
    } catch (err) {
      console.warn(`[bus] Auto-submit of ${target.slug} for "${event.name}" failed:`, err);
    }
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
      { label: "Forms", action: "view:forms", accelerator: "CommandOrControl+P" },
      { label: "Calendar", action: "view:calendar", accelerator: "CommandOrControl+Shift+C" },
      { label: "Views", action: "view:views", accelerator: "CommandOrControl+Shift+V" },
      { label: "Project Settings", action: "view:project-settings", accelerator: "CommandOrControl+," },
      { type: "separator" },
      { label: "Run a Form…", action: "view:run-picker", accelerator: "CommandOrControl+K" },
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

// Watch each project's forms directory and push changes to the renderer live.
const stopWatching = watchForms(await projectPaths(), () => {
  void pushFormsChanged();
});

mainWindow.on("close", () => {
  stopWatching();
  disposeScheduler();
});

console.log("CLIDE started.");
