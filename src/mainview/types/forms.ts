// Re-export the shared domain types for renderer-side consumption so components
// import from a single local module.
export type {
  AIProvider,
  AIService,
  AIServiceKind,
  ArgMapping,
  ArgMappingKind,
  CommandSpec,
  DraftFormSpecInput,
  DraftFormSpecResult,
  FieldType,
  FilterEntry,
  FilterEntryType,
  FormDefinition,
  FormEvents,
  FormField,
  FormFolder,
  FormMeta,
  FormMetaPatch,
  FormSpecDraft,
  GridCardLayout,
  GridCardSize,
  MagicField,
  OutputChunk,
  OutputSpec,
  OutputType,
  Project,
  ProjectLayout,
  RepeatInterval,
  RunRecord,
  RunStatus,
  RunStatusUpdate,
  ThreadView,
  ThreadViewFilters,
  ToolRegistryEntry,
  ToolSource,
  ToolSpec,
  ToolSpecOption,
  ToolSpecPositional,
  ToolSpecSubcommand,
  UIState,
} from "../../shared/types";

// Runtime value re-exports.
export {
  AI_SERVICE_KIND_LABEL,
  AI_SERVICE_KIND_NEEDS_BASE_URL,
  DEFAULT_MODEL_FOR_KIND,
} from "../../shared/types";

// Pure command builder/preview — shared by the runner and the UI so the
// preview shown always matches what will actually execute (ticket 52).
export { buildCommand, formatCommandPreview } from "../../shared/command";
export type { BuiltCommand } from "../../shared/command";
