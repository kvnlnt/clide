import type { RPCSchema } from "electrobun/bun";

// ---------------------------------------------------------------------------
// Domain types — shared between the Bun main process and the React renderer.
// ---------------------------------------------------------------------------

export type FieldType =
  | "text"
  | "textarea"
  | "select"
  | "multicheck"
  | "number"
  | "file"
  | "date";

export type OutputType =
  | "text"
  | "table"
  | "image"
  | "audio"
  | "video"
  | "json";

export type RunStatus =
  | "idle"
  | "pending"
  | "running"
  | "success"
  | "error"
  | "scheduled";

export type Interpreter = "bash" | "python3" | "node" | "bun";

export type RepeatInterval = "none" | "daily" | "weekly";

export type AIProvider = "claude" | "openai" | "ollama";

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  argTemplate?: string;
}

export interface FormDefinition {
  fields: FormField[];
  aiPromptField?: boolean;
  outputType: OutputType;
  scriptFile: string;
}

export interface FormMeta {
  name: string;
  slug: string;
  description: string;
  project: string;
  tags: string[];
  interpreter?: Interpreter;
  createdAt: string;
  updatedAt: string;
}

/** A fully-loaded form folder: metadata + field definition. */
export interface FormFolder {
  meta: FormMeta;
  form: FormDefinition;
  /** Absolute path of the project folder this form belongs to. */
  projectPath: string;
}

/** A user-created project: a folder on disk housing its forms, history & outputs. */
export interface Project {
  /** Absolute path of the project folder. */
  path: string;
  /** Display name (unique across registered projects). */
  name: string;
}

export interface RunRecord {
  id: string;
  formSlug: string;
  inputs: Record<string, unknown>;
  status: RunStatus;
  exitCode: number | null;
  startedAt: string;
  finishedAt: string | null;
  outputPath: string | null;
  pinned: boolean;
  scheduledAt: string | null;
  repeatInterval: RepeatInterval | null;
}

export interface OutputChunk {
  runId: string;
  type: "stdout" | "stderr" | "status";
  data: string;
  timestamp: number;
}

export interface RunStatusUpdate {
  runId: string;
  status: RunStatus;
  exitCode: number | null;
  finishedAt: string | null;
}

// Grid layout persistence ----------------------------------------------------

export type GridCardSize = "small" | "medium" | "large";

export interface GridCardLayout {
  formSlug: string;
  size: GridCardSize;
  position: number;
}

export interface ProjectLayout {
  cards: GridCardLayout[];
}

// AI form creation -----------------------------------------------------------

export interface CreateFormInput {
  name: string;
  description: string;
  project: string;
  provider: AIProvider;
  /** Optional model override; falls back to the provider's default when omitted. */
  model?: string;
}

/** Suggested models per provider (users may also type a custom model name). */
export const AI_MODELS: Record<AIProvider, string[]> = {
  claude: [
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest",
    "claude-3-opus-latest",
  ],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  ollama: [
    "llama3.1",
    "llama3.2",
    "mistral",
    "qwen2.5",
    "qwen2.5-coder",
    "codellama",
    "deepseek-r1",
  ],
};

export interface AISettings {
  ollamaBaseUrl: string;
}

/** Default model used for each provider when none is chosen. */
export const DEFAULT_MODEL: Record<AIProvider, string> = {
  claude: "claude-3-5-sonnet-latest",
  openai: "gpt-4o",
  ollama: "llama3.1",
};

export interface GeneratedForm {
  meta: FormMeta;
  form: FormDefinition;
  script: string;
  scriptExtension: string;
  dependencyCheck?: string;
  installInstructions?: string;
}

export interface CreateFormResult {
  ok: boolean;
  slug?: string;
  error?: string;
  dependencyMissing?: string;
  installInstructions?: string;
}

export interface ScheduleInput {
  formSlug: string;
  inputs: Record<string, unknown>;
  scheduledAt: string;
  repeatInterval: RepeatInterval;
}

// ---------------------------------------------------------------------------
// RPC schema
// ---------------------------------------------------------------------------

export type ClideRPC = {
  bun: RPCSchema<{
    requests: {
      closeWindow: { params: null; response: void };
      minimizeWindow: { params: null; response: void };
      listProjects: { params: Record<string, never>; response: Project[] };
      addProject: {
        params: { name: string; path?: string };
        response: { ok: boolean; project?: Project; error?: string };
      };
      renameProject: {
        params: { path: string; name: string };
        response: { ok: boolean; project?: Project; error?: string };
      };
      removeProject: {
        params: { path: string; deleteFiles?: boolean };
        response: void;
      };
      listForms: { params: Record<string, never>; response: FormFolder[] };
      getRunHistory: {
        params: { formSlug: string; limit: number };
        response: RunRecord[];
      };
      getAllRuns: { params: { project: string | null }; response: RunRecord[] };
      runForm: {
        params: {
          formSlug: string;
          inputs: Record<string, unknown>;
        };
        response: { runId: string };
      };
      cancelRun: { params: { runId: string }; response: void };
      readOutputFile: {
        params: { runId: string };
        response: { mime: string; base64: string } | null;
      };
      getFormScript: {
        params: { formSlug: string };
        response: { script: string; extension: string } | null;
      };
      saveCredentials: {
        params: { provider: AIProvider; key: string };
        response: void;
      };
      hasCredentials: {
        params: { provider: AIProvider };
        response: boolean;
      };
      createForm: { params: CreateFormInput; response: CreateFormResult };
      setPinned: {
        params: { runId: string; pinned: boolean };
        response: void;
      };
      deleteRun: { params: { runId: string }; response: void };
      scheduleRun: { params: ScheduleInput; response: { runId: string } };
      getLayout: {
        params: { projectSlug: string };
        response: ProjectLayout;
      };
      saveLayout: {
        params: { projectSlug: string; layout: ProjectLayout };
        response: void;
      };
      getAISettings: { params: Record<string, never>; response: AISettings };
      saveAISettings: { params: AISettings; response: void };
      chooseDirectory: {
        params: { startingFolder?: string };
        response: string | null;
      };
      openFolder: {
        params: { path: string };
        response: { ok: boolean };
      };
      deleteForm: {
        params: { projectPath: string; slug: string };
        response: { ok: boolean; error?: string };
      };
    };
    messages: {
      logToBun: { msg: string; type?: "info" | "warn" | "error" | "debug" };
    };
  }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      onProjectsChanged: { projects: Project[] };
      onFormsChanged: { forms: FormFolder[] };
      onOutputChunk: OutputChunk;
      onRunStatus: RunStatusUpdate;
    };
  }>;
};
