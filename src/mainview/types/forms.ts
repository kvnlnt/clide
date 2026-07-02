// Re-export the shared domain types for renderer-side consumption so components
// import from a single local module.
export type {
  AIProvider,
  DraftFormSpecInput,
  DraftFormSpecResult,
  FieldType,
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

// Runtime value re-exports (model catalog).
export { AI_MODELS, DEFAULT_MODEL } from "../../shared/types";
