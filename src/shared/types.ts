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
 *  reading legacy `TaskMeta.aiProvider` values written before the migration. */
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

// Output definitions (ticket 86) ---------------------------------------------
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

/** A named, configured output of a task (ticket 86). */
export interface OutputDefinition {
  /** Stable within the task — the future pipeline wiring target. */
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
 * the event-payload fill path was removed with the event bus (ticket 85);
 * workflow data wiring (tickets 88+) is its replacement.
 */
export interface MagicField {
  /** Associative prompt used to fill the field, e.g. "today's date in ISO". */
  prompt: string;
}

/** How a command-backed field's value becomes part of the argv (ticket 52). */
export type ArgMappingKind = "flag" | "option" | "positional" | "env" | "stdin";

/** Maps one task field's value onto the invocation of a command-backed task's tool. */
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

export interface TaskField {
  id: string;
  label: string;
  type: FieldType;
  /** User-facing help text shown under the label on the task card (ticket 61). */
  description?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  /** @deprecated Legacy script-task arg templating (e.g. `--post {{value}}`). Superseded by `argMapping` (ticket 52). */
  argTemplate?: string;
  /** How this field's value maps onto the tool invocation. Command-backed tasks only (ticket 52). */
  argMapping?: ArgMapping;
  magic?: MagicField;
  /** When true, the field's value is masked (•••) before reaching any AI prompt (ticket 98). */
  secret?: boolean;
}

/** A command-backed task's fixed invocation target (ticket 52): one tool, one action. */
export interface CommandSpec {
  /** Tool registry entry id, or a bare executable name/path resolved on PATH (ticket 53). */
  tool: string;
  /** Fixed argv prefix before any field-derived args, e.g. `["convert"]` for a subcommand. */
  baseArgs: string[];
}

export interface TaskDefinition {
  fields: TaskField[];
  aiPromptField?: boolean;
  /** Primary output kind, kept for backward compatibility with old readers. */
  outputType: OutputType;
  /** Named output definitions (ticket 86). Legacy kind-lists normalize to these on load. */
  outputs?: OutputDefinition[];
  /** Present on command-backed tasks (ticket 52); mutually exclusive with `scriptFile` in practice. */
  command?: CommandSpec;
  /** @deprecated Legacy script-backed tasks only. Absent on command-backed tasks. */
  scriptFile?: string;
  /** Engine discriminator (ticket 99): absent or "command" = command-backed, "native" = native tool. */
  engine?: "command" | "native";
  /** Native tool id when engine === "native", e.g. "browser-automation" (ticket 99). */
  nativeTool?: string;
  /** File locations this task works with, for artifact detection (ticket 102). */
  fileAssociations?: { locationId: string; pattern?: string }[];
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

/** AI-distilled structure of a CLI tool's self-documentation, used to draft task fields (ticket 54). */
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
  /** When present, records which package manager installed this binary. */
  installedVia?: { manager: string; package: string; version?: string };

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

// Native tools & browser automation (ticket 99) ------------------------------

/** A native (non-CLI) tool capability built into CLIDE. */
export interface NativeTool {
  id: string;
  name: string;
  description: string;
  icon?: string;
}

/** Selector strategy for targeting DOM elements (ticket 99). */
export type SelectorStrategy = "testid" | "id" | "aria" | "text" | "css";

/** One selector candidate; replay tries them in order. */
export interface SelectorCandidate {
  strategy: SelectorStrategy;
  selector: string;
}

/** Recorded event during browser recording (ticket 99). */
export interface RecordedEvent {
  kind: "click" | "input" | "key" | "scroll";
  selectors: SelectorCandidate[];
  value?: string;
  key?: string;
  x?: number;
  y?: number;
}

/** Base for all browser automation steps. */
interface BrowserStepBase {
  id: string;
  name?: string;
  enabled: boolean;
}

export type BrowserStep =
  | (BrowserStepBase & { type: "navigate"; url: string })
  | (BrowserStepBase & { type: "recorded"; events: RecordedEvent[] })
  | (BrowserStepBase & { type: "click"; selectors: SelectorCandidate[] })
  | (BrowserStepBase & { type: "type"; selectors: SelectorCandidate[]; value: string })
  | (BrowserStepBase & { type: "select"; selectors: SelectorCandidate[]; value: string })
  | (BrowserStepBase & {
      type: "wait";
      for: "selector" | "navigation" | "delay";
      selector?: string;
      ms?: number;
    })
  | (BrowserStepBase & {
      type: "extract";
      selectors: SelectorCandidate[];
      attribute?: string;
      outputName: string;
    })
  | (BrowserStepBase & {
      type: "assert";
      selectors: SelectorCandidate[];
      textContains?: string;
      message?: string;
    })
  | (BrowserStepBase & { type: "screenshot"; label?: string })
  | (BrowserStepBase & {
      type: "coordinate";
      x: number;
      y: number;
      event: "click" | "dblclick";
      viewport: { width: number; height: number; dpr: number };
      referenceShot?: string;
    });

/** Browser automation configuration stored in browser.json (ticket 99). */
export interface BrowserAutomationConfig {
  steps: BrowserStep[];
}

export interface TaskMeta {
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
  /** Lifecycle state: draft = freely editable, adopted = read-only definition (ticket 105). */
  lifecycle: "draft" | "adopted";
  /** Version number; starts at 1, incremented on each edit of an adopted task (ticket 105). */
  version: number;
}

/** A fully-loaded task folder: metadata + field definition. */
export interface TaskFolder {
  meta: TaskMeta;
  task: TaskDefinition;
  /** Absolute path of the project folder this task belongs to. */
  projectPath: string;
  /** Native tool configuration when task.engine === "native" (ticket 99). */
  native?: {
    browser?: BrowserAutomationConfig;
  };
}

/** Editable display metadata for a task. Never includes `slug` — slug is identity. */
export interface TaskMetaPatch {
  name?: string;
  description?: string;
  tags?: string[];
}

/** A user-created project: a folder on disk housing its tasks, history & outputs. */
export interface Project {
  /** Absolute path of the project folder. */
  path: string;
  /** Display name (unique across registered projects). */
  name: string;
}

export interface RunRecord {
  id: string;
  taskSlug: string;
  inputs: Record<string, unknown>;
  status: RunStatus;
  exitCode: number | null;
  startedAt: string;
  finishedAt: string | null;
  outputPath: string | null;
  pinned: boolean;
  scheduledAt: string | null;
  repeatInterval: RepeatInterval | null;
  /** Resolved tool + argv actually executed, for command-backed tasks (ticket 52). */
  command?: { tool: string; argv: string[] } | null;
  /** When the run was marked read (ticket 97). */
  readAt: string | null;
  /** Provenance of auto-submitted runs (ticket 23). */
  triggeredBy?: unknown;
  /** AI-generated one-line status report (ticket 98). */
  summary?: string | null;
  /** Version of the task that was executed (ticket 105). */
  taskVersion: number;
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
  /** AI-generated summary (ticket 98), streamed when available. */
  summary?: string | null;
}

// VFS & Run Artifacts (ticket 102) -------------------------------------------

export type VfsLocationScope = "app" | "project";

/** A registered file location (local disk, Dropbox, Google Drive, etc.). */
export interface VfsLocation {
  id: string;
  name: string;
  /** Provider id: "local", "dropbox", "gdrive". */
  provider: string;
  /** Provider-specific config, e.g. { root: "/Users/..." } for local. */
  config: Record<string, unknown>;
  scope: VfsLocationScope;
  /** Project path when scope === "project"; undefined otherwise. */
  project?: string;
  /** Opt-in fs watching (off by default). */
  watch?: boolean;
}

export interface VfsStatResult {
  name: string;
  size: number;
  mtime: string;
  isDirectory: boolean;
}

export type RunArtifactKind = "created" | "modified" | "deleted";
/** A point-in-time app/machine/workload health snapshot (ticket 124). */
export interface DiagnosticsReport {
  generatedAt: string;
  app: {
    pid: number;
    rssBytes: number;
    heapUsedBytes: number;
    uptimeSec: number;
    version: string;
    dataDir: string;
    dataDirBytes: number;
    projectDbs: { name: string; bytes: number }[];
  };
  machine: {
    platform: string;
    osType: string;
    osRelease: string;
    cpuModel: string;
    cpuCount: number;
    /** 1/5/15-minute load averages. */
    loadavg: number[];
    totalMemBytes: number;
    freeMemBytes: number;
    /** null when `df` couldn't be read. */
    freeDiskBytes: number | null;
  };
  workload: {
    runningTasks: number;
    activeWorkflowRuns: number;
    armedTaskSchedules: number;
    armedWorkflowSchedules: number;
    projectCount: number;
  };
}

export type RunArtifactSource = "declared" | "observed";

/** A file touched by a run (ticket 102). */
export interface RunArtifact {
  runId: string;
  /** Provider-scoped URI, e.g. "local:///Users/..." or "dropbox:/reports/q3.pdf". */
  uri: string;
  name: string;
  kind: RunArtifactKind;
  size?: number;
  mime?: string;
  /** "declared" = from output definitions; "observed" = from snapshot diff. */
  source: RunArtifactSource;
}

// Profiles (tickets 100/101) --------------------------------------------------
// An AI-led interview produces a structured profile that feeds every AI
// feature as standing context. Sections are plain text/markdown — human-
// readable, human-editable, no opaque blobs.

export type ProfileScope = "app" | "project";

/** App-scoped user profile (ticket 100), stored at dev.clide/profile.json. */
export interface UserProfile {
  identity: string;
  roles: string;
  responsibilities: string;
  goals: string[];
  frustrations: string[];
  updatedAt: string;
  interviewCount: number;
  /** The AI's own accumulated interviewing notes: post-session self-critiques
   *  and rejected amendments, seeding the next session's question generation. */
  selfNotes: string;
}

/** Project-scoped profile (ticket 101), stored at <projectPath>/profile.json. */
export interface ProjectProfile {
  purpose: string;
  userRole: string;
  responsibilities: string;
  goals: string[];
  frustrations: string[];
  updatedAt: string;
  interviewCount: number;
  selfNotes: string;
}

/** One asked/answered turn of a profile interview. Empty answer = skipped. */
export interface InterviewTurn {
  question: string;
  answer: string;
  /** Label of the profile section the question targets (ticket 110), when known. */
  category?: string;
}

/** One editable section of a profile draft, as shown on the review screen. */
export interface ProfileSection {
  id: string;
  label: string;
  kind: "text" | "list";
  value: string | string[];
}

/** One proposed change from a reflection pass — always a reviewed diff, never auto-applied. */
export interface ProfileAmendment {
  sectionId: string;
  label: string;
  kind: "text" | "list";
  current: string | string[];
  proposed: string | string[];
  reason: string;
}

// Package manager discovery/search/install ----------------------------------

export interface PackageManagerInfo {
  id: string; // internal id, e.g. "homebrew" or custom name
  name: string; // display name
  path?: string; // absolute path to manager binary when detected or registered
  version?: string; // detected version string
  enabled: boolean; // user-controlled
  detectedAt?: string; // ISO timestamp when detection last ran
  custom?: boolean; // true for user-registered managers
}

export interface PackageCatalogItem {
  managerId: string;
  packageName: string;
  title?: string;
  description?: string;
  homepage?: string;
  installed?: boolean;
  version?: string;
}

export interface PackageBinary {
  name: string;
  path: string; // absolute path to the executable file
}

// Grid layout persistence ----------------------------------------------------

export type GridCardSize = "small" | "medium" | "large";

export interface GridCardLayout {
  taskSlug: string;
  size: GridCardSize;
  position: number;
}

export interface ProjectLayout {
  cards: GridCardLayout[];
}

// Thread views (saved filters, shown as browser-style tabs) ------------------

export type FilterEntryType = "task" | "status" | "keyword";

/**
 * One additive filter chip. Values within an entry combine as OR (e.g. a
 * status entry with Error + Success matches either); entries combine as AND
 * across the whole filter set (ticket 51).
 */
export interface FilterEntry {
  /** Stable identity — used as the edit/remove target for the chip. */
  id: string;
  type: FilterEntryType;
  /** Task slugs, `RunStatus` values, or free-text keywords, depending on `type`. */
  values: string[];
}

export interface ThreadViewFilters {
  /** Additive filter chips (ticket 51). Absent/empty = no filtering. */
  entries?: FilterEntry[];
  /** @deprecated Replaced by `entries` (ticket 51). Older `.views.json` files may still have this. */
  taskSlugs?: string[];
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
  /** User explicitly named/renamed this view (ticket 116) — AI auto-naming never touches it again. */
  namedByUser?: boolean;
}

/** Globally persisted UI state — restores where the user was after a restart. */
export interface UIState {
  activeProject: string | null;
  /** Last active view id per project name. Absent entry = the implicit title tab. */
  activeViewByProject: Record<string, string>;
  /** Project names by recency of activation, most recent first. */
  recentProjects: string[];
  /** Denser spacing across the main surfaces (ticket 119). */
  compactMode?: boolean;
}

/** Catalog entry for a ready-to-go starter task offered during onboarding (ticket 111). */
export interface StarterTask {
  slug: string;
  name: string;
  description: string;
  tags: string[];
}

// Workflows (tickets 88-95) ---------------------------------------------------
// A Workflow is a named, ordered list of Steps plus zero or more Triggers.
// Steps: form step, decision step, loop step, parallel step; sub-lists nest
// arbitrarily deep. Workflows start ONLY via explicit triggers. Full schema
// documented in docs/workflow-schema.md.

interface WorkflowStepBase {
  /** Unique within the workflow, slug-safe, user-editable — the reference target. */
  name: string;
}

/** Runs one existing task; input values are literals or contain {{…}} references. */
export interface TaskStep extends WorkflowStepBase {
  type: "form";
  taskSlug: string;
  inputs: Record<string, string>;
  /** Pinned task version; absent = latest version (ticket 105). */
  taskVersion?: number;
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

export type WorkflowStep = TaskStep | DecisionStep | LoopStep | ParallelStep;

export type WorkflowTrigger =
  | { type: "manual" }
  | { type: "schedule"; cron: string }
  /** Fires when a standalone run of this task completes successfully. */
  | { type: "task-submitted"; taskSlug: string };

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
  /** Task steps: the exact resolved command string that ran. */
  command?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  durationMs?: number;
  resolvedInputs?: Record<string, unknown>;
  /** Decision: evaluated condition + result; skipped: why. */
  note?: string;
  /** Task steps: evaluated named outputs (ticket 86). */
  outputs?: OutputResult[];
}

export type WorkflowRunStatus = "running" | "succeeded" | "failed" | "cancelled";

export interface WorkflowRunTriggerInfo {
  type: WorkflowTrigger["type"];
  /** e.g. the cron expression or triggering task name. */
  detail?: string;
  params?: Record<string, string>;
}

/**
 * A workflow scheduled to run at a future time from the calendar (ticket
 * 117) — distinct from `WorkflowRun` (an actual invocation, running or
 * finished) the same way a scheduled `RunRecord` differs from a completed
 * one. Persisted per project alongside workflow definitions.
 */
export interface ScheduledWorkflowRun {
  id: string;
  workflowId: string;
  /** Denormalized so the calendar/detail UI never needs a workflow lookup that might fail if it's since been deleted. */
  workflowName: string;
  /** Named text values matching the workflow's `params` at schedule time. */
  params: Record<string, string>;
  scheduledAt: string;
  repeatInterval: RepeatInterval;
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
  /** AI-generated one-line status report (ticket 98). */
  summary?: string | null;
  /** When the workflow run was marked read (ticket 97). */
  readAt?: string | null;
}

export interface WorkflowRunSummary {
  runId: string;
  workflowId: string;
  status: WorkflowRunStatus;
  trigger: WorkflowRunTriggerInfo;
  startedAt: string;
  finishedAt: string | null;
}

/** One line of a dry-run plan (ticket 95): compiled command or structural annotation, nothing executed. */
export interface WorkflowPlanEntry {
  name: string;
  type: WorkflowStep["type"];
  depth: number;
  summary: string;
  note?: string;
}

export interface ScheduleInput {
  taskSlug: string;
  inputs: Record<string, unknown>;
  scheduledAt: string;
  repeatInterval: RepeatInterval;
}

// Task versioning (ticket 105) ------------------------------------------------

/** One version's metadata in the version history view. */
export interface TaskVersionInfo {
  version: number;
  createdAt: string;
  lifecycle: "draft" | "adopted";
}

/** Which workflows reference a task and at which steps/versions. */
export interface WorkflowTaskReference {
  workflowId: string;
  workflowName: string;
  /** Step name → version pinned (or undefined = latest). */
  steps: Record<string, number | undefined>;
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
      /** Get the trackUnread flag for a project (ticket 97). */
      getTrackUnread: {
        params: { path: string };
        response: boolean;
      };
      /** Set the trackUnread flag for a project (ticket 97). */
      setTrackUnread: {
        params: { path: string; trackUnread: boolean };
        response: void;
      };
      listTasks: { params: Record<string, never>; response: TaskFolder[] };
      getRunHistory: {
        params: { taskSlug: string; limit: number };
        response: RunRecord[];
      };
      getAllRuns: { params: { project: string | null }; response: RunRecord[] };
      runTask: {
        params: {
          taskSlug: string;
          inputs: Record<string, unknown>;
        };
        response: { runId: string };
      };
      cancelRun: { params: { runId: string }; response: void };
      readOutputFile: {
        params: { runId: string };
        response: { mime: string; base64: string } | null;
      };
      getTaskScript: {
        params: { taskSlug: string };
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
          taskSlug: string;
          /** Field id → magic prompt, for the fields needing fill. */
          fields: Record<string, string>;
        };
        response: { ok: boolean; values?: Record<string, unknown>; error?: string };
      };
      // Profiles (tickets 100/101) --------------------------------------------
      getUserProfile: { params: Record<string, never>; response: UserProfile | null };
      saveUserProfile: {
        params: { profile: UserProfile };
        response: { ok: boolean; error?: string };
      };
      deleteUserProfile: { params: Record<string, never>; response: void };
      getProjectProfile: { params: { projectPath: string }; response: ProjectProfile | null };
      saveProjectProfile: {
        params: { projectPath: string; profile: ProjectProfile };
        response: { ok: boolean; error?: string };
      };
      deleteProjectProfile: { params: { projectPath: string }; response: void };
      /** Next interview question given the transcript so far; done ends the session.
       *  serviceId/model (ticket 107) pick the AI powering the session; default service otherwise. */
      profileInterviewNext: {
        params: {
          scope: ProfileScope;
          projectPath?: string;
          transcript: InterviewTurn[];
          serviceId?: string;
          model?: string;
        };
        response: { ok: boolean; question?: string; category?: string; done?: boolean; error?: string };
      };
      /** Draft profile sections from the transcript + run the engine's self-critique (§4). */
      profileInterviewFinish: {
        params: {
          scope: ProfileScope;
          projectPath?: string;
          transcript: InterviewTurn[];
          serviceId?: string;
          model?: string;
        };
        response: {
          ok: boolean;
          sections?: ProfileSection[];
          selfNotes?: string;
          /** Project scope with no app profile yet: the review screen suggests the app interview. */
          suggestAppInterview?: boolean;
          error?: string;
        };
      };
      /** Reflection over recent activity → proposed amendments (reviewed diff, ticket 100 §4). */
      profileReflect: {
        params: { scope: ProfileScope; projectPath?: string };
        response: {
          ok: boolean;
          amendments?: ProfileAmendment[];
          /** Project reflections may surface app-profile suggestions (ticket 101 §4). */
          appAmendments?: ProfileAmendment[];
          error?: string;
        };
      };
      /** Record a rejected amendment in selfNotes so it isn't re-proposed. */
      recordProfileRejection: {
        params: { scope: ProfileScope; projectPath?: string; note: string };
        response: void;
      };

      // Tool registry & inspection (ticket 53) --------------------------------
      listTools: { params: Record<string, never>; response: ToolRegistryEntry[] };
      listNativeTools: { params: Record<string, never>; response: NativeTool[] };
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

      // Package manager discovery / search / install (ticket 103)
      listPackageManagers: { params: Record<string, never>; response: PackageManagerInfo[] };
      detectPackageManagers: { params: Record<string, never>; response: PackageManagerInfo[] };
      addCustomPackageManager: {
        params: { id: string; name: string; path: string; enabled?: boolean };
        response: { ok: boolean; manager?: PackageManagerInfo; error?: string };
      };
      removeCustomPackageManager: { params: { id: string }; response: void };
      savePackageManagers: { params: { list: any[] }; response: { ok: boolean; error?: string } };
      searchPackageManagers: {
        params: { query: string };
        response: { ok: boolean; results?: PackageCatalogItem[]; error?: string };
      };
      installPackage: {
        params: { managerId: string; packageName: string };
        response: { ok: boolean; installId?: string; error?: string };
      };
      cancelPackageInstall: { params: { installId: string }; response: { ok: boolean } };
      resolvePackageBinaries: {
        params: { managerId: string; packageName: string };
        response: { ok: boolean; binaries?: PackageBinary[]; error?: string };
      };
      /** Stamps provenance on a registry entry after a package-manager-driven install (ticket 103 §4). */
      setToolInstalledVia: {
        params: { id: string; installedVia: { manager: string; package: string; version?: string } };
        response: { ok: boolean; entry?: ToolRegistryEntry; error?: string };
      };

      // Task creation wizard (tickets 54, 59-61) ------------------------------
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
          /** The user's step-1 statement of what the task should do — scopes which options matter (ticket 61). */
          goal: string;
          toolName: string;
          actionName: string;
          spec: ToolSpec;
          serviceId: string;
          model: string;
          /** Project name, when drafting inside one — pulls the project profile into context (ticket 101). */
          project?: string;
        };
        response: { ok: boolean; fields?: TaskField[]; error?: string };
      };
      createCommandTask: {
        params: {
          project: string;
          name: string;
          description: string;
          tags: string[];
          command: CommandSpec;
          fields: TaskField[];
          outputType: OutputType;
          outputs: OutputDefinition[];
        };
        response: { ok: boolean; slug?: string; error?: string };
      };
      createNativeTask: {
        params: {
          project: string;
          name: string;
          description: string;
          tags: string[];
          nativeTool: string;
          fields: TaskField[];
          outputType: OutputType;
          outputs: OutputDefinition[];
          browserConfig?: BrowserAutomationConfig;
        };
        response: { ok: boolean; slug?: string; error?: string };
      };
      /** Evaluated output-definition results persisted for a run (ticket 86). */
      getRunOutputs: {
        params: { runId: string };
        response: OutputResult[];
      };

      // VFS & file locations (ticket 102) -------------------------------------
      listVfsLocations: {
        params: { project?: string };
        response: VfsLocation[];
      };
      addVfsLocation: {
        params: { location: VfsLocation };
        response: { ok: boolean; error?: string };
      };
      updateVfsLocation: {
        params: { location: VfsLocation };
        response: { ok: boolean; error?: string };
      };
      removeVfsLocation: {
        params: { id: string; project?: string };
        response: { ok: boolean; error?: string };
      };
      /**
       * `project` (ticket 118 fix): locations may be project-scoped, and
       * `getLocation` can only find those when given the owning project's
       * path — every call site below must pass the project it's browsing.
       */
      vfsList: {
        params: { locationId: string; path?: string; project?: string };
        response: { entries: VfsStatResult[]; error?: string };
      };
      vfsStat: {
        params: { locationId: string; path: string; project?: string };
        response: VfsStatResult | null;
      };
      vfsSearch: {
        params: { locationId: string; query: string; project?: string };
        response: { paths: string[]; truncated?: boolean; error?: string };
      };
      vfsOpen: {
        params: { locationId: string; path: string; reveal?: boolean; project?: string };
        response: { ok: boolean; error?: string };
      };
      vfsReadPreview: {
        params: { locationId: string; path: string; maxBytes?: number; project?: string };
        response: { base64: string; mime: string; error?: string };
      };
      /**
       * Read/open a fully-qualified VFS URI directly (ticket 118) — for run
       * artifacts, which carry a self-contained URI (e.g. "local:///Users/…")
       * that isn't tied to any registered location, so there's no locationId
       * to resolve through the registry.
       */
      vfsReadByUri: {
        params: { uri: string; maxBytes?: number };
        response: { base64: string; mime: string; error?: string };
      };
      vfsOpenByUri: {
        params: { uri: string; reveal?: boolean };
        response: { ok: boolean; error?: string };
      };
      getRunArtifacts: {
        params: { runId: string };
        response: RunArtifact[];
      };

      /** Point-in-time app/machine/workload snapshot (ticket 124) — gathered fresh on every call, nothing polls. */
      getDiagnostics: { params: Record<string, never>; response: DiagnosticsReport };

      /** Regenerates the transparency manifest and returns the app data dir to reveal (ticket 125). */
      prepareTransparencyReveal: { params: Record<string, never>; response: { ok: boolean; path?: string } };

      // Workflows (tickets 88-95) ---------------------------------------------
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
      /** terraform-plan analogue: compiled commands, nothing executed, nothing persisted (ticket 95). */
      dryRunWorkflow: {
        params: { project: string; workflowId: string; params?: Record<string, string> };
        response: { ok: boolean; plan?: WorkflowPlanEntry[]; problems?: string[]; error?: string };
      };
      /** Re-run one task step from a past run's captured inputs; never mutates the run (ticket 95). */
      replayWorkflowStep: {
        params: { project: string; runId: string; recordIndex: number };
        response: { ok: boolean; record?: WorkflowStepRecord; error?: string };
      };
      /** AI-drafts a workflow from a goal against the project's existing tasks (ticket 92). */
      draftWorkflow: {
        params: { project: string; goal: string; name: string; serviceId: string; model: string };
        response: { ok: boolean; workflow?: Workflow; notes?: string[]; error?: string };
      };

      /** Duplicate an existing workflow into a new one and return the new workflow. */
      duplicateWorkflow: {
        params: { project: string; id: string };
        response: { ok: boolean; workflow?: Workflow; error?: string };
      };

      /** Calendar workflow scheduling (ticket 117) — mirrors the task schedule RPCs below. */
      getScheduledWorkflows: {
        params: { project: string };
        response: ScheduledWorkflowRun[];
      };
      scheduleWorkflowRun: {
        params: {
          project: string;
          workflowId: string;
          workflowName: string;
          params: Record<string, string>;
          scheduledAt: string;
          repeatInterval: RepeatInterval;
        };
        response: { ok: boolean; id?: string; error?: string };
      };
      rescheduleWorkflowRun: {
        params: { project: string; id: string; scheduledAt: string; repeatInterval: RepeatInterval };
        response: { ok: boolean };
      };
      cancelScheduledWorkflowRun: {
        params: { project: string; id: string };
        response: void;
      };
      runScheduledWorkflowRunNow: {
        params: { project: string; id: string };
        response: { ok: boolean };
      };

      setPinned: {
        params: { runId: string; pinned: boolean };
        response: void;
      };
      deleteRun: { params: { runId: string }; response: void };
      /** Mark task runs as read (ticket 97). */
      markRunsRead: {
        params: { runIds: string[] };
        response: void;
      };
      /** Mark workflow runs as read (ticket 97). */
      markWorkflowRunsRead: {
        params: { project: string; runIds: string[] };
        response: void;
      };
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
      /** AI-suggested short view name from its filters + a sample of matching runs (ticket 116). */
      suggestViewName: {
        params: { filterSummary: string; sampleRuns: string[] };
        response: { ok: boolean; name?: string; error?: string };
      };
      getUIState: { params: Record<string, never>; response: UIState };
      saveUIState: { params: UIState; response: void };
      /** Onboarding starter-task catalog + install-into-project (ticket 111). */
      listStarterTasks: { params: Record<string, never>; response: StarterTask[] };
      installStarterTasks: {
        params: { projectName: string; slugs: string[] };
        response: { ok: boolean; error?: string };
      };
      chooseDirectory: {
        params: { startingFolder?: string };
        response: string | null;
      };
      openFolder: {
        params: { path: string };
        response: { ok: boolean };
      };
      deleteTask: {
        params: { projectPath: string; slug: string };
        response: { ok: boolean; error?: string };
      };
      updateTaskMeta: {
        params: { projectPath: string; slug: string; patch: TaskMetaPatch };
        response: { ok: boolean; error?: string };
      };
      // Task adoption & versioning (ticket 105) -------------------------------
      adoptTask: {
        params: { projectPath: string; slug: string };
        response: { ok: boolean; error?: string };
      };
      saveTaskVersion: {
        params: {
          projectPath: string;
          slug: string;
          meta: Omit<TaskMeta, "slug" | "createdAt" | "updatedAt">;
          task: TaskDefinition;
        };
        response: { ok: boolean; version?: number; error?: string };
      };
      listTaskVersions: {
        params: { projectPath: string; slug: string };
        response: { ok: boolean; versions?: TaskVersionInfo[]; error?: string };
      };
      loadTaskVersion: {
        params: { projectPath: string; slug: string; version: number };
        response: { ok: boolean; folder?: TaskFolder; error?: string };
      };
      rollbackTaskVersion: {
        params: { projectPath: string; slug: string; version: number };
        response: { ok: boolean; newVersion?: number; error?: string };
      };
      getWorkflowsReferencingTask: {
        params: { projectPath: string; slug: string };
        response: { workflows: WorkflowTaskReference[] };
      };
      upgradeWorkflowTaskVersion: {
        params: { projectPath: string; workflowId: string; stepNames: string[]; newVersion: number };
        response: { ok: boolean; error?: string };
      };
      // Native browser automation (ticket 99 slice 2-3) ----------------------
      saveBrowserConfig: {
        params: { projectPath: string; slug: string; config: BrowserAutomationConfig };
        response: { ok: boolean; error?: string };
      };
      runBrowserStep: {
        params: { projectPath: string; slug: string; stepId: string; inputs: Record<string, unknown> };
        response: { ok: boolean; trace?: string[]; error?: string };
      };
      startBrowserRecording: {
        params: { url: string };
        response: { ok: boolean; recordingId?: string; error?: string };
      };
      stopBrowserRecording: {
        params: { recordingId: string };
        response: { ok: boolean; events?: RecordedEvent[]; error?: string };
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
      onTasksChanged: { tasks: TaskFolder[] };
      onOutputChunk: OutputChunk;
      onRunStatus: RunStatusUpdate;
      /** Native application-menu item clicked (e.g. View → Tasks); action is a `view:*` id. */
      onMenuAction: { action: string };
      /** Live workflow-run state push (ticket 89/94): full run record on every step transition. */
      onWorkflowRunUpdate: { run: WorkflowRun };
    };
  }>;
};
