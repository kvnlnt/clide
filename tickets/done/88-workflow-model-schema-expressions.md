# Ticket 88 — Workflow Model, File Schema & Expression Language

Part of the **Workflow epic (79-86)**: orchestrate existing CLIDE forms into
ordered, multi-step automations. A **Workflow** is a linear, vertically
ordered list of **Steps** (no node/edge canvas); control flow is expandable
nested blocks. Workflows start only via explicit **Triggers** — submitting a
form on its own never propagates into a workflow. Vocabulary is fixed:
_Workflow, Step (form step / decision step / loop step / parallel step),
Trigger (manual / schedule / form-submitted), Run._

## Goal

The foundation everything else builds on: the data model, the on-disk file
format, the `{{…}}` reference/expression language with its scope rules, and
the CRUD plumbing. **Deliverable #1 is a written schema + grammar doc for
review before the editor is built** (per the feature spec).

## Acceptance criteria

### 1. Model & types ([types.ts](../src/shared/types.ts))

- `Workflow`: `id`, `name`, `description`, ordered `steps: Step[]`,
  `triggers: Trigger[]`, `enabled`, `createdAt`/`updatedAt`.
- `Step` (discriminated union on `type`), every step has a unique,
  user-editable slug-safe `name`:
  - **form step**: `formSlug`, `inputs: Record<fieldId, string>` where each
    value is a literal or contains `{{…}}` references;
  - **decision step**: `condition` (expression string), `then: Step[]`,
    optional `else: Step[]`;
  - **loop step**: `over` (expression resolving to a list), `steps: Step[]`,
    current item exposed as `item`;
  - **parallel step**: `branches: Step[][]` (≥2), concurrent, rejoining
    before the next sibling.
- Sub-lists nest arbitrarily deep — any step type inside any sub-list.

### 2. On-disk format

- **JSON** (matches `form.json`/`meta.json`/`.views.json` precedent —
  diffable, versionable): one file per workflow at
  `<project>/workflows/<slug>.json`, path helpers in
  [paths.ts](../src/bun/paths.ts), `ensureProjectDirs` extended.
- Loader/writer pair modeled on [forms/loader.ts](../src/bun/forms/loader.ts)
  / writer: tolerant validation (malformed file → skipped with a warning,
  never a crash), slug-directory identity, timestamps maintained on write.
- **`docs/workflow-schema.md`**: the full schema with a worked example
  (fetch → loop → decision), and the expression grammar below. This doc is
  the review artifact — write it first.

### 3. Expression & reference language

- Template syntax `{{expr}}` inside step input strings; a field that is
  exactly one `{{expr}}` resolves to the raw value (list/object allowed),
  otherwise interpolates stringified values.
- Expression grammar, minimal and safe — **no arbitrary JS, no eval**:
  property access (`fetch_rss.items`, `item.title`), `.length`, literals
  (string/number/boolean), comparisons (`== != < <= > >=`), boolean ops
  (`&& || !`), parentheses. A small hand-rolled tokenizer + recursive-descent
  evaluator in a new pure shared module (e.g. `src/shared/workflowExpr.ts`)
  with unit-style exhaustive edge handling (missing property → undefined,
  never a throw).
- Root scope names: prior step names, `trigger`, `item` (inside loops).
  Form-step output shape addressable per step name: `stdout`, `stderr`,
  `exitCode`, plus `outputs.<definitionName>` for the form's named output
  definitions (ticket 86) — e.g. `{{fetch_rss.outputs.items}}`.

### 4. Scope resolution (pure, shared with the editor)

- `stepsInScope(workflow, stepPath)` returns the steps a given step may
  reference: **earlier siblings and ancestors' earlier siblings** — steps
  guaranteed complete beforehand. Steps in a parallel sibling branch or an
  unexecuted decision branch are out of scope. This function is the single
  source of truth for editor validation (ticket 91), autocomplete, and the
  engine's resolution environment (ticket 89).

### 5. CRUD RPC

- `listWorkflows { project }`, `saveWorkflow { project, workflow }`,
  `deleteWorkflow { project, id }` in [index.ts](../src/bun/index.ts) +
  [rpc.ts](../src/mainview/rpc.ts); renderer state in AppContext mirroring
  the views pattern (load on project switch, live via the file watcher if
  cheap, else on-demand refresh).

## Files to modify

- `src/shared/types.ts`, new `src/shared/workflowExpr.ts`
- New: `src/bun/workflows/loader.ts`, `src/bun/workflows/writer.ts`
- `src/bun/paths.ts`, `src/bun/index.ts`, `src/mainview/rpc.ts`,
  `src/mainview/context/AppContext.tsx`
- New: `docs/workflow-schema.md`

## Edge cases

- Duplicate step names within a workflow are invalid at the model level
  (validated on save, flagged by the editor later) — references depend on
  uniqueness.
- A workflow referencing a deleted form still loads (form steps validate at
  edit/run time, not load time).
- Expression evaluator: comparing mixed types follows JS loose semantics is
  NOT acceptable — define strict semantics in the doc (`==` is strict
  equality; comparisons on non-numbers → false).

## Note

Depends on tickets 85 (event bus removed — form-submitted _triggers_ replace
it) and 77 (named output definitions are the reference targets). Everything
in 80-86 depends on this.
