// Re-export the shared domain types for renderer-side consumption so components
// import from a single local module.
export type {
  AIProvider,
  AIService,
  AIServiceKind,
  ArgMapping,
  ArgMappingKind,
  BrowserAutomationConfig,
  BrowserStep,
  CommandSpec,
  DecisionStep,
  Extraction,
  ExtractionSelector,
  ExtractionSource,
  FieldType,
  FilterEntry,
  FilterEntryType,
  GridCardLayout,
  GridCardSize,
  InterviewTurn,
  LoopStep,
  MagicField,
  NativeTool,
  OutputChunk,
  OutputDefinition,
  OutputResult,
  OutputTransform,
  OutputType,
  ParallelStep,
  ProfileAmendment,
  ProfileScope,
  ProfileSection,
  Project,
  ProjectLayout,
  ProjectProfile,
  RepeatInterval,
  RunRecord,
  RunStatus,
  RunStatusUpdate,
  ScheduledWorkflowRun,
  SelectorCandidate,
  StarterTask,
  TaskDefinition,
  TaskField,
  TaskFolder,
  TaskMeta,
  TaskMetaPatch,
  TaskStep,
  ThreadView,
  ThreadViewFilters,
  ToolRegistryEntry,
  ToolSource,
  ToolSpec,
  ToolSpecOption,
  ToolSpecPositional,
  ToolSpecSubcommand,
  UIState,
  UserProfile,
  Workflow,
  WorkflowPlanEntry,
  WorkflowRun,
  WorkflowRunStatus,
  WorkflowRunSummary,
  WorkflowStep,
  WorkflowStepRecord,
  WorkflowStepStatus,
  WorkflowTrigger,
} from "../../shared/types";

// Runtime value re-exports.
export { AI_SERVICE_KIND_LABEL, AI_SERVICE_KIND_NEEDS_BASE_URL, DEFAULT_MODEL_FOR_KIND } from "../../shared/types";

// Profile section specs & converters (tickets 100/101) — shared with the bun
// side so the review UI and the engine agree on one section shape.
export {
  isProfileContentEmpty,
  projectProfileToSections,
  sectionsToProjectProfile,
  sectionsToUserProfile,
  userProfileToSections,
} from "../../shared/profile";

// Pure command builder/preview — shared by the runner and the UI so the
// preview shown always matches what will actually execute (ticket 52).
export { buildCommand, describeFieldMapping, formatCommandPreview } from "../../shared/command";
export type { BuiltCommand } from "../../shared/command";

// Pure output-definition evaluator (ticket 86) — the wizard's live test runs
// the very same code as the runner.
export { evaluateOutputs } from "../../shared/outputs";
