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

// Output definitions (ticket 77) ---------------------------------------------
// The CLI's raw output is always captured as-is; each OutputDefinition
// additionally EXTRACTS (and optionally transforms) a named piece of it.
// These named outputs are the ports the workflow layer wires together.

/** Where an extraction reads from. "file": the selector names a filesystem path. */
export type ExtractionSource = "stdout" | "stderr" | "file";

export type ExtractionSelector =
  | { type: "whole" }
  | { type: "regex"; pattern: string; group?: number }
  | { type: "jsonPath"; path: string }
  | { type: "lines"; from?: number; to?: number }
  /** The last line of output that is an existing absolute path — the media convention, made explicit. */
  | { type: "lastPathLine" };

export interface Extraction {
  source: ExtractionSource;
  selector: ExtractionSelector;
}

/** Light, ordered reshaping applied after extraction. */
export type OutputTransform =
  | { type: "pickKeys"; mapping: Record<string, string> }
  | { type: "template"; template: string }
  | { type: "parseNumber" }
  | { type: "trim" };

/** A named, configured output of a form (ticket 77). */
export interface OutputDefinition {
  /** Stable within the form — the future pipeline wiring target. */
  id: string;
  /** User label, e.g. "Upload URL", "Size report". */
  name: string;
  /** How the extracted value is typed/rendered. */
  kind: OutputType;
  extraction: Extraction;
  transforms?: OutputTransform[];
}

/** One evaluated output-definition result for a run. */
export interface OutputResult {
  id: string;
  name: string;
  kind: OutputType;
  ok: boolean;
  /** Extracted/transformed value; for media kinds, the resolved file path. */
  value?: unknown;
  /** Human-readable failure, e.g. "output wasn't valid JSON". */
  error?: string;
}

/**
 * AI auto-fill configuration for a field (ticket 24). Prompt-based only —
 * the event-payload fill path was removed with the event bus (ticket 76);
 * workflow data wiring (tickets 79+) is its replacement.
 */
export interface MagicField {
  /** Associative prompt used to fill the field, e.g. "today's date in ISO". */
  prompt: string;
}

/** How a command-backed field's value becomes part of the argv (ticket 52). */
export type ArgMappingKind = "flag" | "option" | "positional" | "env" | "stdin";

/** Maps one form field's value onto the invocation of a command-backed form's tool. */
export interface ArgMapping {
  kind: ArgMappingKind;
  /** Flag token for "flag"/"option", e.g. "--verbose" or "-o". Defaults to `--<field id>`. */
  flag?: string;
  /** For "option": `--flag value` (default) vs. `--flag=value`. */
  style?: "space" | "equals";
  /** For "positional": explicit ordering among positional fields (ascending; ties broken by field order). */
  order?: number;
  /** For "option"/"positional" with an array value: repeat the flag per value instead of joining with commas. */
  repeat?: boolean;
  /** For "env": environment variable name. Defaults to the field id, upper-cased. */
  envName?: string;
}

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  /** User-facing help text shown under the label on the form card (ticket 61). */
  description?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  /** @deprecated Legacy script-form arg templating (e.g. `--post {{value}}`). Superseded by `argMapping` (ticket 52). */
  argTemplate?: string;
  /** How this field's value maps onto the tool invocation. Command-backed forms only (ticket 52). */
  argMapping?: ArgMapping;
  magic?: MagicField;
}

/** A command-backed form's fixed invocation target (ticket 52): one tool, one action. */
export interface CommandSpec {
  /** Tool registry entry id, or a bare executable name/path resolved on PATH (ticket 53). */
  tool: string;
  /** Fixed argv prefix before any field-derived args, e.g. `["convert"]` for a subcommand. */
  baseArgs: string[];
}

export interface FormDefinition {
  fields: FormField[];
  aiPromptField?: boolean;
  /** Primary output kind, kept for backward compatibility with old readers. */
  outputType: OutputType;
  /** Named output definitions (ticket 77). Legacy kind-lists normalize to these on load. */
  outputs?: OutputDefinition[];
  /** Present on command-backed forms (ticket 52); mutually exclusive with `scriptFile` in practice. */
  command?: CommandSpec;
  /** @deprecated Legacy script-backed forms only. Absent on command-backed forms. */
  scriptFile?: string;
}

// Tool registry & AI inspection (ticket 53) ----------------------------------

export type ToolSource = "discovered" | "custom";

export interface ToolSpecSubcommand {
  name: string;
  description: string;
}

export interface ToolSpecOption {
  /** All flag spellings for this option, e.g. `["-o", "--output"]`. */
  flags: string[];
  description: string;
  takesValue: boolean;
  repeatable?: boolean;
}

export interface ToolSpecPositional {
  name: string;
  description: string;
}

/** AI-distilled structure of a CLI tool's self-documentation, used to draft form fields (ticket 54). */
export interface ToolSpec {
  description: string;
  subcommands: ToolSpecSubcommand[];
  options: ToolSpecOption[];
  positionals: ToolSpecPositional[];
  examples: string[];
}

/** A CLI tool CLIDE knows about — discovered on PATH or registered by dropping an executable (ticket 55). */
export interface ToolRegistryEntry {
  id: string;
  /** Display name, editable — defaults to the executable's basename. */
  name: string;
  /** Resolved absolute path at last successful resolve. */
  execPath: string;
  source: ToolSource;
  /** Raw captured `--help`/`man` text (or user-pasted docs), kept even if distillation fails. */
  helpText?: string;
  /** AI-distilled structure, when distillation has succeeded. */
  spec?: ToolSpec;
  inspectedAt?: string;
  /** Which AI service + model produced `spec`. */
  inspectedWith?: { serviceId: string; model: string };
  /**
   * Version fingerprint captured at inspection time (ticket 60): the first
   * line of `--version` output when the tool has one, else the binary's
   * size+mtime. A mismatch on later use flags the cached spec as stale.
   */
  fingerprint?: string;
  /** Set when the executable was last found missing at resolve time; never touches the entry's persistence. */
  missing?: boolean;
  /**
   * SHA-256 of the original bytes, set only for `source: "custom"` entries
   * whose executable was copied in via drag-and-drop (ticket 55) — dedupes
   * re-drops of the same binary without depending on its original path.
   */
  sourceHash?: string;
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
  /** Resolved tool + argv actually executed, for command-backed forms (ticket 52). */
  command?: { tool: string; argv: string[] } | null;
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

export type FilterEntryType = "form" | "status" | "keyword";

/**
 * One additive filter chip. Values within an entry combine as OR (e.g. a
 * status entry with Error + Success matches either); entries combine as AND
 * across the whole filter set (ticket 51).
 */
export interface FilterEntry {
  /** Stable identity — used as the edit/remove target for the chip. */
  id: string;
  type: FilterEntryType;
  /** Form slugs, `RunStatus` values, or free-text keywords, depending on `type`. */
  values: string[];
}

export interface ThreadViewFilters {
  /** Additive filter chips (ticket 51). Absent/empty = no filtering. */
  entries?: FilterEntry[];
  /** @deprecated Replaced by `entries` (ticket 51). Older `.views.json` files may still have this. */
  formSlugs?: string[];
  /** @deprecated Replaced by `entries` (ticket 51). */
  statuses?: RunStatus[];
  /** @deprecated Replaced by `entries` (ticket 51). */
  keywords?: string[];
  /** @deprecated Replaced by `entries` (ticket 51). */
  keywordMode?: "and" | "or";
  /**
   * @deprecated Oldest legacy shape, superseded by `keywords` then `entries`.
   * Older `.views.json` files may still have this.
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

// Workflows (tickets 79-86) ---------------------------------------------------
// A Workflow is a named, ordered list of Steps plus zero or more Triggers.
// Steps: form step, decision step, loop step, parallel step; sub-lists nest
// arbitrarily deep. Workflows start ONLY via explicit triggers. Full schema
// documented in docs/workflow-schema.md.

interface WorkflowStepBase {
  /** Unique within the workflow, slug-safe, user-editable — the reference target. */
  name: string;
}

/** Runs one existing form; input values are literals or contain {{…}} references. */
export interface FormStep extends WorkflowStepBase {
  type: "form";
  formSlug: string;
  inputs: Record<string, string>;
}

export interface DecisionStep extends WorkflowStepBase {
  type: "decision";
  /** Expression (see workflowExpr grammar); truthy → then, else → else. */
  condition: string;
  then: WorkflowStep[];
  else?: WorkflowStep[];
}

export interface LoopStep extends WorkflowStepBase {
  type: "loop";
  /** Expression resolving to a list; sub-steps run once per element, bound as `item`. */
  over: string;
  steps: WorkflowStep[];
}

export interface ParallelStep extends WorkflowStepBase {
  type: "parallel";
  /** ≥2 sibling sub-lists, run concurrently, rejoining before the next step. */
  branches: WorkflowStep[][];
}

export type WorkflowStep = FormStep | DecisionStep | LoopStep | ParallelStep;

export type WorkflowTrigger =
  | { type: "manual" }
  | { type: "schedule"; cron: string }
  /** Fires when a standalone run of this form completes successfully. */
  | { type: "form-submitted"; formSlug: string };

export interface Workflow {
  id: string;
  name: string;
  description: string;
  /** Named text parameters prompted for on manual runs; addressable as trigger.params.<name>. */
  params?: string[];
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowStepStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

/** One per-step record in a Run's trace. Loop iterations are indexed ("resize[2]"). */
export interface WorkflowStepRecord {
  name: string;
  type: WorkflowStep["type"];
  status: WorkflowStepStatus;
  /** Nesting depth, for trace indentation. */
  depth: number;
  /** Form steps: the exact resolved command string that ran. */
  command?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  durationMs?: number;
  resolvedInputs?: Record<string, unknown>;
  /** Decision: evaluated condition + result; skipped: why. */
  note?: string;
  /** Form steps: evaluated named outputs (ticket 77). */
  outputs?: OutputResult[];
}

export type WorkflowRunStatus = "running" | "succeeded" | "failed" | "cancelled";

export interface WorkflowRunTriggerInfo {
  type: WorkflowTrigger["type"];
  /** e.g. the cron expression or triggering form name. */
  detail?: string;
  params?: Record<string, string>;
}

export interface WorkflowRun {
  runId: string;
  workflowId: string;
  workflowName: string;
  /** Snapshot of the definition at run time — replay resolves against this, not the current file. */
  workflow: Workflow;
  trigger: WorkflowRunTriggerInfo;
  status: WorkflowRunStatus;
  startedAt: string;
  finishedAt: string | null;
  records: WorkflowStepRecord[];
}

export interface WorkflowRunSummary {
  runId: string;
  workflowId: string;
  status: WorkflowRunStatus;
  trigger: WorkflowRunTriggerInfo;
  startedAt: string;
  finishedAt: string | null;
}

/** One line of a dry-run plan (ticket 86): compiled command or structural annotation, nothing executed. */
export interface WorkflowPlanEntry {
  name: string;
  type: WorkflowStep["type"];
  depth: number;
  summary: string;
  note?: string;
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
      fillMagicFields: {
        params: {
          formSlug: string;
          /** Field id → magic prompt, for the fields needing fill. */
          fields: Record<string, string>;
        };
        response: { ok: boolean; values?: Record<string, unknown>; error?: string };
      };
      // Tool registry & inspection (ticket 53) --------------------------------
      listTools: { params: Record<string, never>; response: ToolRegistryEntry[] };
      resolveTool: {
        params: { nameOrPath: string };
        response: { ok: boolean; execPath?: string; error?: string };
      };
      inspectTool: {
        params: {
          nameOrPath: string;
          /** Display name override; defaults to the executable's basename. */
          name?: string;
          source: ToolSource;
          serviceId: string;
          model: string;
        };
        response: { ok: boolean; entry?: ToolRegistryEntry; error?: string };
      };
      /** Registers a tool without capturing/distilling help — the confirm step's "just add it" path. */
      registerTool: {
        params: { nameOrPath: string; name?: string; source: ToolSource };
        response: { ok: boolean; entry?: ToolRegistryEntry; error?: string };
      };
      /** Re-distills an entry's stored (or freshly pasted) help text with a chosen service+model. */
      redistillTool: {
        params: { id: string; helpText?: string; serviceId: string; model: string };
        response: { ok: boolean; entry?: ToolRegistryEntry; error?: string };
      };
      updateTool: {
        params: { id: string; name?: string };
        response: { ok: boolean; entry?: ToolRegistryEntry; error?: string };
      };
      /** `deleteBinary` also removes the copied executable for custom installs (ticket 58); ignored otherwise. */
      removeTool: { params: { id: string; deleteBinary?: boolean }; response: void };
      /** Drag-and-drop registration (ticket 55): copies the dropped bytes into CLIDE's own storage and chmods +x. */
      registerDroppedTool: {
        params: { fileName: string; base64: string };
        response: { ok: boolean; entry?: ToolRegistryEntry; error?: string };
      };
      /** Native file dialog for picking a single file (ticket 58's custom-tool install). */
      chooseFile: {
        params: { startingFolder?: string };
        response: string | null;
      };
      /** Picker-path custom-tool install (ticket 58): main process reads the bytes directly, no base64 round-trip. */
      installToolFromPath: {
        params: { path: string };
        response: { ok: boolean; entry?: ToolRegistryEntry; error?: string };
      };

      // Form creation wizard (tickets 54, 59-61) ------------------------------
      suggestTools: {
        params: { query: string; serviceId: string; model: string };
        response: { ok: boolean; suggestions?: string[]; error?: string };
      };
      /** Models offered for a service's model select (ticket 59): live-queried for local kinds, curated for hosted. */
      listServiceModels: {
        params: { serviceId: string };
        response: { ok: boolean; models?: string[]; error?: string };
      };
      /** Compares a registry entry's stored version fingerprint to the binary's current one (ticket 60). */
      checkToolFreshness: {
        params: { id: string };
        response: { ok: boolean; stale?: boolean; entry?: ToolRegistryEntry; error?: string };
      };
      draftCommandFields: {
        params: {
          /** The user's step-1 statement of what the form should do — scopes which options matter (ticket 61). */
          goal: string;
          toolName: string;
          actionName: string;
          spec: ToolSpec;
          serviceId: string;
          model: string;
        };
        response: { ok: boolean; fields?: FormField[]; error?: string };
      };
      createCommandForm: {
        params: {
          project: string;
          name: string;
          description: string;
          tags: string[];
          command: CommandSpec;
          fields: FormField[];
          outputType: OutputType;
          outputs: OutputDefinition[];
        };
        response: { ok: boolean; slug?: string; error?: string };
      };
      /** Evaluated output-definition results persisted for a run (ticket 77). */
      getRunOutputs: {
        params: { runId: string };
        response: OutputResult[];
      };

      // Workflows (tickets 79-86) ---------------------------------------------
      listWorkflows: { params: { project: string }; response: Workflow[] };
      saveWorkflow: {
        params: { project: string; workflow: Workflow };
        response: { ok: boolean; error?: string };
      };
      deleteWorkflow: { params: { project: string; id: string }; response: void };
      startWorkflowRun: {
        params: { project: string; workflowId: string; params?: Record<string, string> };
        response: { ok: boolean; runId?: string; error?: string };
      };
      cancelWorkflowRun: { params: { project: string; runId: string }; response: void };
      listWorkflowRuns: {
        params: { project: string; workflowId?: string };
        response: WorkflowRunSummary[];
      };
      getWorkflowRun: {
        params: { project: string; runId: string };
        response: WorkflowRun | null;
      };
      /** terraform-plan analogue: compiled commands, nothing executed, nothing persisted (ticket 86). */
      dryRunWorkflow: {
        params: { project: string; workflowId: string; params?: Record<string, string> };
        response: { ok: boolean; plan?: WorkflowPlanEntry[]; problems?: string[]; error?: string };
      };
      /** Re-run one form step from a past run's captured inputs; never mutates the run (ticket 86). */
      replayWorkflowStep: {
        params: { project: string; runId: string; recordIndex: number };
        response: { ok: boolean; record?: WorkflowStepRecord; error?: string };
      };
      /** AI-drafts a workflow from a goal against the project's existing forms (ticket 83). */
      draftWorkflow: {
        params: { project: string; goal: string; name: string; serviceId: string; model: string };
        response: { ok: boolean; workflow?: Workflow; notes?: string[]; error?: string };
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
      /** Native application-menu item clicked (e.g. View → Forms); action is a `view:*` id. */
      onMenuAction: { action: string };
      /** Live workflow-run state push (ticket 80/85): full run record on every step transition. */
      onWorkflowRunUpdate: { run: WorkflowRun };
    };
  }>;
};
