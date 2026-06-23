import { Electroview } from "electrobun/view";
import type {
  AIProvider,
  AISettings,
  ClideRPC,
  CreateFormInput,
  CreateFormResult,
  FormFolder,
  OutputChunk,
  Project,
  ProjectLayout,
  RepeatInterval,
  RunRecord,
  RunStatusUpdate,
} from "../shared/types";

// ---------------------------------------------------------------------------
// Event bus for push messages from the Bun main process.
// ---------------------------------------------------------------------------
type EventMap = {
  projects: Project[];
  forms: FormFolder[];
  chunk: OutputChunk;
  status: RunStatusUpdate;
};

type Listener<K extends keyof EventMap> = (payload: EventMap[K]) => void;

const listeners: { [K in keyof EventMap]: Set<Listener<K>> } = {
  projects: new Set(),
  forms: new Set(),
  chunk: new Set(),
  status: new Set(),
};

function emit<K extends keyof EventMap>(key: K, payload: EventMap[K]): void {
  for (const l of listeners[key]) l(payload);
}

export function on<K extends keyof EventMap>(
  key: K,
  listener: Listener<K>,
): () => void {
  listeners[key].add(listener);
  return () => listeners[key].delete(listener);
}

// ---------------------------------------------------------------------------
// Electroview RPC setup.
// ---------------------------------------------------------------------------
const rpcDef = Electroview.defineRPC<ClideRPC>({
  maxRequestTime: 5000,
  handlers: {
    requests: {},
    messages: {
      onProjectsChanged: ({ projects }) => emit("projects", projects),
      onFormsChanged: ({ forms }) => emit("forms", forms),
      onOutputChunk: (chunk) => emit("chunk", chunk),
      onRunStatus: (update) => emit("status", update),
    },
  },
});

let electroview: Electroview<typeof rpcDef> | null = null;
try {
  electroview = new Electroview({ rpc: rpcDef });
} catch (err) {
  console.warn(
    "[rpc] Electroview unavailable (running outside Electrobun?)",
    err,
  );
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

  async addProject(
    name: string,
    path?: string,
  ): Promise<{ ok: boolean; project?: Project; error?: string }> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.addProject({ name, path });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async renameProject(
    path: string,
    name: string,
  ): Promise<{ ok: boolean; project?: Project; error?: string }> {
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

  async listForms(): Promise<FormFolder[]> {
    const r = request();
    if (!r) return [];
    try {
      return await r.listForms({});
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

  async getRunHistory(formSlug: string, limit: number): Promise<RunRecord[]> {
    const r = request();
    if (!r) return [];
    try {
      return await r.getRunHistory({ formSlug, limit });
    } catch {
      return [];
    }
  },

  async runForm(
    formSlug: string,
    inputs: Record<string, unknown>,
  ): Promise<string | null> {
    const r = request();
    if (!r) return null;
    try {
      const { runId } = await r.runForm({ formSlug, inputs });
      return runId;
    } catch {
      return null;
    }
  },

  async cancelRun(runId: string): Promise<void> {
    await request()?.cancelRun({ runId });
  },

  async readOutputFile(
    runId: string,
  ): Promise<{ mime: string; base64: string } | null> {
    const r = request();
    if (!r) return null;
    try {
      return await r.readOutputFile({ runId });
    } catch {
      return null;
    }
  },

  async getFormScript(
    formSlug: string,
  ): Promise<{ script: string; extension: string } | null> {
    const r = request();
    if (!r) return null;
    try {
      return await r.getFormScript({ formSlug });
    } catch {
      return null;
    }
  },

  async saveCredentials(provider: AIProvider, key: string): Promise<void> {
    await request()?.saveCredentials({ provider, key });
  },

  async hasCredentials(provider: AIProvider): Promise<boolean> {
    const r = request();
    if (!r) return false;
    try {
      return await r.hasCredentials({ provider });
    } catch {
      return false;
    }
  },

  async createForm(input: CreateFormInput): Promise<CreateFormResult> {
    const r = request();
    if (!r) return { ok: false, error: "Bridge unavailable" };
    try {
      return await r.createForm(input);
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async setPinned(runId: string, pinned: boolean): Promise<void> {
    await request()?.setPinned({ runId, pinned });
  },

  async deleteRun(runId: string): Promise<void> {
    await request()?.deleteRun({ runId });
  },

  async scheduleRun(
    formSlug: string,
    inputs: Record<string, unknown>,
    scheduledAt: string,
    repeatInterval: RepeatInterval,
  ): Promise<string | null> {
    const r = request();
    if (!r) return null;
    try {
      const { runId } = await r.scheduleRun({
        formSlug,
        inputs,
        scheduledAt,
        repeatInterval,
      });
      return runId;
    } catch {
      return null;
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

  async getAISettings(): Promise<AISettings> {
    const r = request();
    if (!r) return { ollamaBaseUrl: "http://localhost:11434" };
    try {
      return await r.getAISettings({});
    } catch {
      return { ollamaBaseUrl: "http://localhost:11434" };
    }
  },

  async saveAISettings(settings: AISettings): Promise<void> {
    await request()?.saveAISettings(settings);
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

  log(msg: string, type?: "info" | "warn" | "error" | "debug"): void {
    send()?.logToBun({ msg, type });
  },
};
