# Ticket 64 — Step 3 Field Editor: Labeled Cards, Not Cryptic Rows

## Goal

The step-3 field editor
([CommandFieldsEditor.tsx](../src/mainview/components/CommandFieldsEditor.tsx))
reads as a row of **unlabeled widgets**: a chevron, a blank input (it's the
Label — nothing says so), a bare type select, a tiny Optional checkbox, and a
truncated mono cell. Expanded, it gets worse: an unlabeled description input
above a "Command line" box fronted by a kind select. Nobody can tell what
configures what. Rebuild each field as a **card with every control labeled**,
so a first-time user can configure a field without guessing.

## Acceptance criteria

### 1. Card anatomy

- Each field renders as a card with a clear **header** and an **editing
  body** (always visible for the card being edited; collapsed cards show
  header only):
  - Header: the field's label as the card title (fallback `Untitled field`
    styled as a placeholder, never a blank), a one-line summary underneath
    (`file · optional · --input <value>`), reorder controls, delete.
  - Clicking a collapsed card opens it for editing; only one card open at a
    time (accordion), so the list stays scannable.
- **Every input in the body has a visible label and, where useful, a hint**:
  - `Label` — *"Shown as the field's title on the form"*
  - `Help text` — *"Tells the person filling the form what to enter"*
  - `Input type` — with the hint naming what the user will see (text box,
    file picker, dropdown…)
  - `Placeholder` — currently not editable at all in this editor despite
    existing on `FormField`; add it back
  - `Options` (select/multicheck only)
  - `Required` presented as a labeled toggle/checkbox with copy that says
    what it means for the form ("the form can't be submitted without it"),
    not a floating "Optional" checkbox.
- The command-line mapping area is a titled sub-section (*"On the command
  line"*) — its redesign is ticket 65; this ticket gives it the labeled
  frame.

### 2. New-field flow

- "Add field" creates a card that opens immediately with focus in the Label
  input — the first thing the user does is name the field, which fixes the
  "blank input that seems to do nothing" problem at the root.
- A card with an empty label is visually flagged (placeholder title +
  subtle warning) and the wizard's CREATE summary treats it as unfinished
  (empty-label fields are dropped or blocked with a clear message — pick
  blocked, silent dropping hides mistakes).

## Files to modify

- `src/mainview/components/CommandFieldsEditor.tsx` (rebuild)
- `src/mainview/components/NewFormPage.tsx` (create-time validation message)

## Edge cases

- Reordering stays available on collapsed cards (header controls) — no need
  to open a card to move it.
- Cards with AI-drafted content open collapsed (they have labels); only
  hand-added fields open expanded.
- Keyboard: Enter in the Label input collapses/commits the card; Escape
  collapses without losing typed values (state is controlled, nothing to
  revert).

## Note

Part of the step-3 clarity batch (64–66) with 65 (plain-language mapping)
and 66 (live preview). 64 is the frame; land it first.
