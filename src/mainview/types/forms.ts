// Re-export the shared domain types for renderer-side consumption so components
// import from a single local module.
export type {
  AIProvider,
  FieldType,
  FormDefinition,
  FormField,
  FormFolder,
  FormMeta,
  GridCardLayout,
  GridCardSize,
  OutputChunk,
  OutputType,
  Project,
  ProjectLayout,
  RepeatInterval,
  RunRecord,
  RunStatus,
  RunStatusUpdate,
} from "../../shared/types";

// Runtime value re-exports (model catalog).
export { AI_MODELS, DEFAULT_MODEL } from "../../shared/types";
