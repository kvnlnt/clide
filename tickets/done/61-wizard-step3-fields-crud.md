# Ticket 61 — Wizard Step 3: Pre-Drafted Field CRUD & Featured Command Line

## Goal

Step 3 should open **already populated**: fields drafted from the user's
step-1 goal plus the chosen tool's spec, with no button to press first. The
step is a clean CRUD over input fields — label, description, type, optional
flag, and a visible "what this becomes on the command line" — headlined by
the live command preview so it's always clear what will be submitted.

## Acceptance criteria

### 1. Auto-draft on entry

- Entering step 3 for the first time (with a tool spec and an AI service
  available) triggers `draftCommandFields` automatically, seeded with the
  **step-1 goal text** in addition to the tool/action/spec (extend
  [commandFields.ts](../src/bun/ai/commandFields.ts)'s prompt — the goal is
  what scopes *which* of the tool's options matter).
- A subtle "Re-draft with AI" affordance remains for after manual edits; a
  failed/unavailable draft leaves an empty list and the CRUD below — never a
  blocked step.

### 2. Field CRUD

- Add / edit / delete fields
  ([CommandFieldsEditor.tsx](../src/mainview/components/CommandFieldsEditor.tsx)
  reworked). Each field editor row exposes:
  - **Label** (user-friendly),
  - **Description** — new `description?: string` on `FormField`
    ([types.ts](../src/shared/types.ts)); shown as help text under the
    field's label on the form card
    ([FormCardBody.tsx](../src/mainview/components/FormCardBody.tsx)) and
    persisted/validated through
    [loader.ts](../src/bun/forms/loader.ts),
  - **Input type** (existing `FieldType` select),
  - **Optional** checkbox (the inverse presentation of today's `required` —
    stored as `required` unchanged; default new fields to optional),
  - **Command line** — a read-only, live cell showing exactly what this one
    field contributes to the argv (e.g. `--width <Width>`, `<Input file>`,
    `WIDTH=<Width>`, `stdin`), derived from the same shared serializer the
    preview uses ([command.ts](../src/shared/command.ts) — factor out a
    per-field `tokensFor` preview helper rather than duplicating mapping
    logic).

### 3. Featured command line

- The full command preview moves from the bottom of the step to a
  **featured block at the top**, pinned above the field list: tool +
  base args + each field's placeholder tokens, updating live as fields are
  added/edited/reordered/removed. This is the step's headline — "what is
  being submitted" is answered before any field is read.

## Files to modify

- `src/mainview/components/NewFormPage.tsx`,
  `src/mainview/components/CommandFieldsEditor.tsx`
- `src/shared/types.ts`, `src/shared/command.ts`
- `src/bun/ai/commandFields.ts` (goal-seeded prompt; drafts `description`
  per field), `src/bun/index.ts` / `src/mainview/rpc.ts` (pass the goal)
- `src/bun/forms/loader.ts`, `src/mainview/components/FormCardBody.tsx`
  (field description round-trip + display)

## Edge cases

- Re-entering step 3 after Back does not re-draft over the user's edits —
  auto-draft fires only when the field list is untouched/empty for the
  current tool+action.
- A field with no arg mapping shows "not passed to the command" in the
  command-line cell rather than nothing.
- Auto-draft with no AI service configured is skipped silently (manual CRUD
  from empty), matching the wizard's AI-never-gates rule.

## Note

Part of the wizard cleanup batch (57–63). Depends on 59 (goal text exists)
and 60 (tool chosen in step 2).
