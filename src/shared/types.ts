import type { RPCSchema } from "electrobun/bun";

// ---------------------------------------------------------------------------
// Domain types — shared between the Bun main process and the React renderer.
// ---------------------------------------------------------------------------

export type FieldType = "text" | "textarea" | "select" | "multicheck" | "number" | "file" | "date";

export type OutputType = "text" | "table" | "image" | "audio" | "video" | "json";

export type RunStatus = "idle" | "pending" | "running" | "success" | "error" | "scheduled";

export type Interpreter = "bash" | "python3" | "node" | "bun";

export type RepeatInterval = "none" | "daily" | "weekly";

/** @deprecated Superseded by `AIService`/`AIServiceKind` (ticket 45). Kept for
 *  reading legacy `FormMeta.aiProvider` values written before the migration. */
export type AIProvider = "claude" | "openai" | "ollama";

/** A configurable AI backend, local or remote. Replaces the old fixed 3-provider list. */
export type AIServiceKind = "anthropic" | "openai" | "openai-compatible" | "ollama";

export interface AIService {
  id: string;
  /** User-facing label, e.g. "Work Claude" or "Local Llama". */
  name: string;
  kind: AIServiceKind;
  /** Required for "openai-compatible" and "ollama"; optional override for the hosted kinds. */
  baseUrl?: string;
  /** Model override; falls back to a sensible per-kind default when omitted. */
  model?: string;
  /** Request timeout in ms; advanced, optional. */
  timeoutMs?: number;
  /** Used when a feature needs a service without asking. At most one should be true. */
  isDefault?: boolean;
}

export const AI_SERVICE_KIND_LABEL: Record<AIServiceKind, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
  "openai-compatible": "OpenAI-compatible",
  ollama: "Ollama",
};

/** Which kinds require a base URL (vs. having a fixed hosted endpoint). */
export const AI_SERVICE_KIND_NEEDS_BASE_URL: Record<AIServiceKind, boolean> = {
  anthropic: false,
  openai: false,
  "openai-compatible": true,
  ollama: true,
};

export const DEFAULT_MODEL_FOR_KIND: Record<AIServiceKind, string> = {
  anthropic: "claude-3-5-sonnet-latest",
  openai: "gpt-4o-mini",
  "openai-compatible": "gpt-4o-mini",
  ollama: "llama3.2",
};

/** One output or side effect a form produces. A form may have several. */
export interface OutputSpec {
  kind: OutputType | "effect";
  /** For kind "effect": human description, e.g. "updates the artifact index". */
  description?: string;
}

/** Auto-fill configuration for a field. Runtime lands in ticket 24. */
export interface MagicField {
  /** Associative prompt used to fill the field, e.g. "today's date in ISO". */
  prompt: string;
  /**
   * Where fill data comes from:
   * - "prompt": the prompt alone is enough (AI completes it).
   * - "event":  the payload of the event that triggered the form feeds the
   *             prompt (ticket 23 supplies the payload).
   */
  source: "prompt" | "event";
}

/** Event wiring declared by a form. Runtime lands in ticket 23. */
export interface FormEvents {
  /** Event names fired when a run completes successfully, e.g. "media:created". */
  emits: string[];
  /** Event names that auto-submit this form when observed. */
  listensFor: string[];
}

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  argTemplate?: string;
  magic?: MagicField;
}

export interface FormDefinition {
  fields: FormField[];
  aiPromptField?: boolean;
  /** Primary output kind, kept for backward compatibility with old readers. */
  outputType: OutputType;
  /** All outputs/effects. Normalized on load from outputType when absent. */
  outputs?: OutputSpec[];
  events?: FormEvents;
  scriptFile: string;
}

/** AI-drafted, user-editable plan for a form. Never persisted to disk. */
export interface FormSpecDraft {
  inputs: FormField[];
  /** Step-by-step description of what the script should do. */
  procedure: string;
  outputs: OutputSpec[];
  events: FormEvents;
  interpreter: Interpreter;
}

export interface FormMeta {
  name: string;
  slug: string;
  description: string;
  project: string;
  tags: string[];
  interpreter?: Interpreter;
  /** Provider/model used at generation time; preferred for magic fills. */
  aiProvider?: AIProvider;
  aiModel?: string;
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

/** Editable display metadata for a form. Never includes `slug` — slug is identity. */
export interface FormMetaPatch {
  name?: string;
  description?: string;
  tags?: string[];
}

/** A user-created project: a folder on disk housing its forms, history & outputs. */
export interface Project {
  /** Absolute path of the project folder. */
  path: string;
  /** Display name (unique across registered projects). */
  name: string;
}

/** Provenance of an auto-submitted run (internal event bus, ticket 23). */
export interface RunTrigger {
  /** Event name that triggered the run, e.g. "media:created". */
  event: string;
  /** Run id of the emitting run (its output is the event payload). */
  sourceRunId: string;
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
  /** Set when the run was auto-submitted by the event bus. */
  triggeredBy?: RunTrigger | null;
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

// Thread views (saved filters, shown as browser-style tabs) ------------------

export interface ThreadViewFilters {
  /** Only runs of these forms. */
  formSlugs?: string[];
  /** Only runs in these statuses. */
  statuses?: RunStatus[];
  /** Free-text keywords matched against form name / run inputs. */
  keywords?: string[];
  /** "and" = every keyword must match; "or" (default) = any keyword matches. */
  keywordMode?: "and" | "or";
  /**
   * @deprecated Replaced by `keywords`. Older `.views.json` files may still
   * have this; normalized to `keywords: [query]` on load.
   */
  query?: string;
}

/** A named, saved filter over a project's thread. The default "All" view is implicit. */
export interface ThreadView {
  /** Stable identity — uuid. Name is not identity; two views may share a name. */
  id: string;
  name: string;
  filters: ThreadViewFilters;
  /** Hidden views stay saved but don't render in the tab strip. */
  hidden?: boolean;
}

/** Globally persisted UI state — restores where the user was after a restart. */
export interface UIState {
  activeProject: string | null;
  /** Last active view id per project name. Absent entry = the implicit title tab. */
  activeViewByProject: Record<string, string>;
  /** Project names by recency of activation, most recent first. */
  recentProjects: string[];
}

// AI form creation -----------------------------------------------------------

export interface CreateFormInput {
  name: string;
  description: string;
  project: string;
  /** Which configured AI service to generate with. */
  serviceId: string;
  /** Fine-tuned spec from the creation wizard. When present, generation is spec-driven. */
  spec?: FormSpecDraft;
}

export interface DraftFormSpecInput {
  name: string;
  project: string;
  /** What information does this form collect? */
  input: string;
  /** What should the script do with it? */
  processing: string;
  /** What does it produce or affect? May be blank (AI infers). */
  output: string;
  /** Which configured AI service to draft with. */
  serviceId: string;
}

export interface DraftFormSpecResult {
  ok: boolean;
  spec?: FormSpecDraft;
  error?: string;
}

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
      saveServiceCredential: {
        params: { serviceId: string; key: string };
        response: void;
      };
      hasServiceCredential: {
        params: { serviceId: string };
        response: boolean;
      };
      listAIServices: { params: Record<string, never>; response: AIService[] };
      saveAIServices: { params: { services: AIService[] }; response: void };
      testAIService: {
        params: { serviceId: string };
        response: { ok: boolean; error?: string };
      };
      createForm: { params: CreateFormInput; response: CreateFormResult };
      draftFormSpec: { params: DraftFormSpecInput; response: DraftFormSpecResult };
      fillMagicFields: {
        params: {
          formSlug: string;
          /** Field id → magic prompt, for the fields needing fill. */
          fields: Record<string, string>;
          /** Optional event payload context (event-triggered fills). */
          payload?: { text: string; json?: unknown };
        };
        response: { ok: boolean; values?: Record<string, unknown>; error?: string };
      };
      setPinned: {
        params: { runId: string; pinned: boolean };
        response: void;
      };
      deleteRun: { params: { runId: string }; response: void };
      scheduleRun: { params: ScheduleInput; response: { runId: string } };
      updateScheduledRun: {
        params: { runId: string; scheduledAt: string; repeatInterval: RepeatInterval };
        response: { ok: boolean };
      };
      runScheduledNow: { params: { runId: string }; response: { ok: boolean } };
      getLayout: {
        params: { projectSlug: string };
        response: ProjectLayout;
      };
      saveLayout: {
        params: { projectSlug: string; layout: ProjectLayout };
        response: void;
      };
      getViews: {
        params: { project: string };
        response: ThreadView[];
      };
      saveViews: {
        params: { project: string; views: ThreadView[] };
        response: void;
      };
      getUIState: { params: Record<string, never>; response: UIState };
      saveUIState: { params: UIState; response: void };
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
      updateFormMeta: {
        params: { projectPath: string; slug: string; patch: FormMetaPatch };
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
