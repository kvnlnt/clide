# Ticket 66 — Step 3 Live Preview: See the Form as It Will Appear

## Goal

Configuring a field and knowing **what the person filling the form will
actually see** are two different things, and step 3 currently only shows the
first (plus a command string). Add a live **"How it will look"** preview to
step 3: the real rendered form field(s) — same components the form card uses
— updating as the user edits, so "will this be clear to whoever runs it?" is
answered by looking, not imagining.

## Acceptance criteria

### 1. Preview pane

- Step 3 becomes a two-column layout on wide windows (config left, preview
  right; stacked with the preview below on narrow ones). The preview panel
  is titled **"How it will look"** and renders the field list exactly as
  [FormCardBody.tsx](../src/mainview/components/FormCardBody.tsx) will:
  label, required asterisk, help text, and the real input control
  ([FormField.tsx](../src/mainview/components/FormField.tsx)) — reuse those
  components rather than approximating them; extract shared pieces if
  needed so the preview can't drift from the real card.
- The preview is **interactive**: typing/choosing in it feeds sample values
  into the featured command preview at the top of the step, so the user
  sees `--width 200` materialize from their own sample input. Sample values
  are wizard-local scratch state — never persisted to the form.

### 2. Edit ↔ preview linkage

- The field being edited (open card, ticket 64) is highlighted in the
  preview (subtle ring), and clicking a field in the preview opens its card
  — the two panes are two views of one list, and navigation works from
  either side.
- Empty-label fields render in the preview with the same placeholder-title
  flag as their card (ticket 64), making "this will look broken" visible
  before CREATE.

### 3. Command line stays the headline

- The featured command block (ticket 61) remains pinned at the top spanning
  both columns, now fed by the preview's sample values when present and the
  `<Label>` placeholders otherwise.

## Files to modify

- `src/mainview/components/NewFormPage.tsx` (step-3 layout)
- New: `src/mainview/components/FormPreview.tsx`
- `src/mainview/components/FormCardBody.tsx` / `FormField.tsx` (export/reuse
  the field-rendering pieces; no visual changes to real cards)
- `src/mainview/components/CommandFieldsEditor.tsx` (open-card ↔ preview
  highlight linkage)

## Edge cases

- Zero fields: preview shows the real card's "No inputs — press SEND to
  run" state plus the bare command — still informative.
- A `stdin`-mapped textarea's sample value must not bloat the command
  preview line — represent it as `… | tool` or a `(stdin)` marker, matching
  `describeFieldMapping`'s language.
- Preview sample values reset when a field's type changes (a string sample
  in a number field would render as garbage).

## Note

Part of the step-3 clarity batch (64–66); lands after 64 (cards) and works
best with 65 (plain-language mapping), but has no hard dependency on 65.
