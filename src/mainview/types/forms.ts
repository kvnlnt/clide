// Re-export the shared domain types for renderer-side consumption so components
// import from a single local module.
export type {
  AIProvider,
  AIService,
  AIServiceKind,
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
  UIState,
} from "../../shared/types";

// Runtime value re-exports.
export {
  AI_SERVICE_KIND_LABEL,
  AI_SERVICE_KIND_NEEDS_BASE_URL,
  DEFAULT_MODEL_FOR_KIND,
} from "../../shared/types";
