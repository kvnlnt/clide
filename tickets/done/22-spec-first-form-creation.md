# Ticket 22 — Spec-First Form Creation Wizard

## Goal

Replace the single-description creation flow with a **two-step wizard**:

1. **Describe** — three free-text boxes: **Input**, **Processing**, **Output**.
2. **Fine-tune** — the AI converts those descriptions into a structured,
   editable **form spec** (inputs, procedure, outputs/effects, events, magic
   fields). The user adjusts anything, then hits **Generate** and the script +
   form are created from the _approved spec_, not from raw prose.

This ticket owns the schema evolution (multiple outputs, event declarations,
magic-field config) and the wizard UI. The **runtime** for events and magic
fill land in tickets 23 and 24 — here they are captured and persisted only.

## Background

- Creation currently lives in [NewFormModal.tsx](../src/mainview/components/NewFormModal.tsx):
  one `description` textarea → `api.createForm(CreateFormInput)` →
  [formGenerator.ts](../src/bun/ai/formGenerator.ts) prompts the provider once
  and returns a complete `GeneratedForm` (meta + form + script) written by
  [writer.ts](../src/bun/forms/writer.ts).
- `FormDefinition` ([types.ts](../src/shared/types.ts#L29-L34)) has a single
  `outputType` and no notion of effects or events. `FormField` has no
  auto-fill capability.
- Forms are loaded by [loader.ts](../src/bun/forms/loader.ts); any schema
  additions must be backward compatible with existing `form.json` files on
  disk.

## Concept

New shared types (in [types.ts](../src/shared/types.ts)):

```ts
/** One output or side effect a form produces. A form may have several. */
interface OutputSpec {
  kind: OutputType | "effect"; // text | table | image | audio | video | json | effect
  /** For kind "effect": human description, e.g. "updates the artifact index". */
  description?: string;
}

/** Auto-fill configuration for a field. Runtime lands in ticket 24. */
interface MagicField {
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
interface FormEvents {
  /** Event names fired when a run completes successfully, e.g. "media:created". */
  emits: string[];
  /** Event names that auto-submit this form when observed. */
  listensFor: string[];
}

// FormField gains:      magic?: MagicField
// FormDefinition gains: outputs?: OutputSpec[]   (outputType stays, see compat)
//                       events?: FormEvents
```

The wizard's intermediate artifact:

```ts
/** AI-drafted, user-editable plan for a form. Never persisted to disk. */
interface FormSpecDraft {
  inputs: Array<FormField>; // includes magic config
  procedure: string; // step-by-step description of the script
  outputs: OutputSpec[];
  events: FormEvents;
  interpreter: Interpreter;
}
```

## Acceptance criteria

### 1. Step one — describe

- [NewFormModal.tsx](../src/mainview/components/NewFormModal.tsx) step 1 keeps
  Name / Project / Provider / Model / API-key, and replaces the single
  description textarea with **three labeled textareas**:
  - **Input** — "What information does this form collect?"
  - **Processing** — "What should the script do with it?"
  - **Output** — "What does it produce or affect?"
- Primary action is **Draft form →** (not "Create"). It calls a new RPC
  `draftFormSpec` and advances to step 2 with a spinner state while drafting.
- Input and Processing are required; Output may be blank (AI infers).

### 2. Drafting RPC

- New `draftFormSpec` in [formGenerator.ts](../src/bun/ai/formGenerator.ts):
  takes `{ name, project, input, processing, output, provider, model? }`,
  prompts the provider to return **only** a `FormSpecDraft` JSON (reuse
  `extractJson`), validates/normalizes it (unknown field types → "text",
  unknown output kinds → "text", missing arrays → empty), and returns it.
- Registered in [types.ts](../src/shared/types.ts) (`ClideRPC`),
  [index.ts](../src/bun/index.ts), and [rpc.ts](../src/mainview/rpc.ts)
  following the `createForm` pattern (including credential/dependency errors).

### 3. Step two — fine-tune

Step 2 renders the draft as an editable spec, in five sections:

1. **Inputs** — list editor: each row shows label, field type (select over
   existing `FieldType`), required toggle, and a **magic** toggle. Expanding a
   row reveals placeholder, options (for select/multicheck), and — when magic
   is on — the magic **prompt** textarea and **source** select
   (`prompt` / `event`). Rows can be added, removed, and reordered.
2. **Procedure** — one textarea with the AI's step-by-step plan for the
   script, user-editable.
3. **Outputs** — checklist of output kinds (text, table, image, audio, video,
   json) plus zero or more **effect** rows with free-text descriptions;
   multiple selections allowed, at least one required.
4. **Emits** — tag-style editor of event names fired on successful
   completion.
5. **Listens for** — tag-style editor of event names that auto-submit this
   form (informational until ticket 23).

- Footer: **← Back** (returns to step 1 with descriptions intact),
  **Generate form** (primary), Cancel/× (unchanged semantics).

### 4. Generation from spec

- `createForm` (or a new `createFormFromSpec` if cleaner) accepts the
  fine-tuned `FormSpecDraft`. The generation prompt is rebuilt around the
  spec: the field list is passed **verbatim** (the AI must not invent or drop
  fields — it only fills `argTemplate`s), the script is generated from
  `procedure`, and `outputs`/`events`/`magic` are copied into the written
  `form.json` untouched.
- Written `form.json` contains `outputs`, `events`, and per-field `magic`.
  `outputType` is still written as the first non-effect output kind (or
  "text") so old readers keep working.

### 5. Backward compatibility

- [loader.ts](../src/bun/forms/loader.ts) normalizes on read: missing
  `outputs` → `[{ kind: outputType }]`; missing `events` → empty arrays;
  missing `magic` → undefined. Existing forms load and run unchanged.
- Output components keep rendering from `outputType` for now (multi-output
  rendering is out of scope).

## Out of scope

- Event bus runtime (ticket 23) — `emits`/`listensFor` are stored, not wired.
- Magic auto-fill runtime (ticket 24) — `magic` is stored, not executed.
- Editing the spec of an _existing_ form (future ticket; identity/slug issues).

## Files to modify

- `src/shared/types.ts` — `OutputSpec`, `MagicField`, `FormEvents`,
  `FormSpecDraft`, `FormField.magic`, `FormDefinition.outputs/events`,
  `draftFormSpec` + createForm RPC changes.
- `src/bun/ai/formGenerator.ts` — `draftFormSpec`, spec-driven generation
  prompt, schema spec text.
- `src/bun/forms/writer.ts` / `loader.ts` — persist + normalize new fields.
- `src/bun/index.ts`, `src/mainview/rpc.ts`, `src/mainview/types/forms.ts` —
  RPC plumbing/re-exports.
- `src/mainview/components/NewFormModal.tsx` — two-step wizard.
- New `src/mainview/components/SpecEditor.tsx` (+ small subcomponents as
  needed: input row editor, tag editor).

## Edge cases

- AI returns malformed spec → error state on step 1 with retry (keep texts).
- Zero inputs is valid (button-only form).
- Duplicate field ids from the AI → de-dupe by suffixing (`-2`).
- Event names: trim, lowercase, non-empty; suggest `domain:verb` format in
  placeholder copy but don't enforce.
