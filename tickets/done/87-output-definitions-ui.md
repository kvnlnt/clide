# Ticket 87 — Output Definitions: Authoring UI & Run-Card Display

## Goal

Surface ticket 86's output model. Wizard step 4 becomes a real outputs
editor — add/edit/delete named output definitions with plain-language
extraction controls and a live test — and the run card renders each defined
output as its own labeled block alongside the always-present raw output.

## Acceptance criteria

### 1. Wizard step 4: outputs editor

- Step 4 (events are gone per ticket 85) opens with copy that sets the
  model: _"The command's raw output is always captured. Add outputs to
  extract specific pieces from it — each becomes a named result you can
  use later."_
- **"+ Add output"** creates a definition card (ticket 64's labeled-card
  pattern): Name, Kind, and an extraction section phrased in plain
  language —
  - _Read from_: command output (stdout) / error output (stderr) / a file
    the command names;
  - _Take_: everything / lines N–M / the part matching a pattern (regex +
    capture group) / the JSON value at a path / the last printed file path;
  - _Then_ (optional, per kind): pick & rename JSON keys, format into a
    text template, parse as a number, trim.
- Multiple definitions of any kind are allowed (two JSON outputs with
  different paths is the headline case). Duplicate _names_ get the
  ticket-65-style warning hint.
- **Live test**: a sample-output box (prefilled from the tool's most recent
  run when one exists, pasteable otherwise) runs the ticket-77 engine as
  the user edits and shows each definition's extracted value or its
  human-readable failure — extraction is designed by watching it work, the
  same philosophy as the command preview.
- AI-drafted forms and the create payload use the new shape; the old
  `OutputKindPicker` toggle-chip row is retired.

### 2. Run-card display

- The Results tab shows the **raw output first** (exactly as today), then
  one labeled block per defined output — name as the block header, body
  rendered by kind through the existing renderers (`TableOutput`,
  `JsonOutput`, media viewers, `AutoSizeOutput` text), values fetched via
  `getRunOutputs`.
- A failed extraction renders its block with the error message in the
  standard muted/error styling — visible, not silently absent.
- Legacy runs/forms (single migrated definition) look essentially as they
  do today: raw + one block.

### 3. Summaries

- Anywhere output kinds are summarized (form card meta, SubmittedSummary
  untouched — check `FormsPanel` descriptions) reflects definitions by
  name+kind, not the old kind list.

## Files to modify

- `src/mainview/components/NewFormPage.tsx`, new
  `OutputDefinitionsEditor.tsx` (replaces `OutputsEvents.tsx` remains)
- `src/mainview/components/output/OutputBlock.tsx` (raw + named blocks)
- `src/mainview/components/FormCard.tsx` (fetch/pass run outputs)
- `src/bun/ai/commandFields.ts` or a sibling prompt if AI drafting of
  output definitions is included — optional; manual authoring is the
  requirement, AI drafting of outputs may be a fast-follow

## Edge cases

- Zero definitions: the card shows raw output only — a perfectly valid
  form.
- The live test with no sample available runs against empty input and says
  so, rather than faking success.
- Media-kind definitions can't preview their binary in the test box — show
  the resolved path instead.
- Deleting a definition that a future pipeline references is out of scope
  here; the workflow feature owns referential integrity when it lands.

## Note

Depends on 76 and 77. Together they turn outputs into the named,
transformable ports the pipeline/workflow automation will connect.
