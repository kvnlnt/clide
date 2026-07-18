# Ticket 91 — Workflow Editor: Vertical List, Nested Blocks, References

Part of the Workflow epic (79-86). Depends on 79; pairs with 83 (AI wizard)
and 84 (surface/navigation that hosts it).

## Goal

The workflow editor: a **vertical list read top to bottom** — add, reorder
(drag within the list), delete steps. No canvas, no drag-to-connect edges.
Decision/loop/parallel steps render as **expandable nested blocks** with
indented sub-lists, collapsed by default when not being edited. Form steps
are the rock-solid core: pick a form, fill its fields with literals or
`{{…}}` references with autocomplete, and always see the compiled command.

## Acceptance criteria

### 1. List & blocks

- Full-window editor surface (Settings/wizard overlay mechanic, tickets
  37/67) with name/description/enabled at top, triggers section (ticket 90
  types), then the step list.
- Step cards follow the ticket-64 labeled-card pattern: header with the
  step's **name** (unique, slug-safe, editable — duplicate names flagged),
  type badge, summary line; reorder handles; delete. Drag-to-reorder within
  a list; nested sub-lists indent inside their parent block and collapse to
  a one-line summary ("3 steps") when not being edited.
- Add-step chooser offers the four types at any list position and inside
  any sub-list, arbitrary nesting depth.

### 2. Form step editor — simple and obvious

- Pick a form (searchable, `useFormSearch`), then its fields render exactly
  as the real card does (ticket 66's FormPreview reuse pattern).
- **Each field accepts a literal value or a reference**: an inline `{{`
  triggers autocomplete over in-scope step outputs — powered by
  `stepsInScope` (ticket 88) and each form's output definitions (ticket 86)
  — listing `stepname.outputs.<name>`, `stepname.stdout`, `trigger.…`,
  `item.…` (inside loops). Chips or highlighted tokens make references
  visually distinct from literals.
- **"Wire from previous step" affordance**: for the common case, a field
  offers a one-click picker of the immediately-referable outputs (this is
  the "outputs of one form become inputs of the next" path — one click, no
  syntax typing).
- **Live compiled command** per form step (the ticket-52/61 serializer):
  resolved literals inline, unresolved references shown as
  `⟨fetch_rss.outputs.items⟩` placeholders.

### 3. Decision / loop / parallel editors

- Decision: condition expression input (with the same autocomplete), then/
  else sub-lists (else addable on demand).
- Loop: `over` expression input, sub-list, and a fixed hint that `item` is
  the current element.
- Parallel: two branches by default, "+ branch" for more; each branch is a
  sub-list.

### 4. Edit-time validation

- Live, non-blocking flags (ticket-64/65 warning style) for: unknown
  references, **out-of-scope references** (parallel sibling / unexecuted
  decision branch — via `stepsInScope`), duplicate step names, missing
  required form fields with no literal or reference, expression syntax
  errors, missing forms. A validation summary gates Save the way empty
  labels gate form CREATE.

## Files to modify

- New: `src/mainview/components/workflow/WorkflowEditor.tsx`,
  `StepList.tsx`, `StepCard.tsx`, `FormStepEditor.tsx`,
  `ReferenceInput.tsx` (autocomplete input, reusable for conditions)
- `src/mainview/App.tsx` (overlay hosting), `AppContext.tsx` (open/close
  editor state)
- `src/shared/workflowExpr.ts` (parse-only entry for syntax validation)

## Edge cases

- Reordering a step above one that references it flips the reference
  out-of-scope — the flag appears immediately, nothing silently breaks.
- Deleting a referenced step flags every dangling reference by name.
- Deep nesting stays usable: collapsed-by-default plus breadcrumb-style
  indent guides; no horizontal scrolling at 3-4 levels.
- Escape follows ticket 75 (closes the editor; unsaved-changes confirm via
  the ticket-74 dialog).

## Note

The editor is also the fine-tune stage of the AI wizard (ticket 92) — build
it as a controlled component over a `Workflow` value so the wizard can hand
it a prefilled draft.
