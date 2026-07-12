# Ticket 65 — Field Mapping in Plain Language, Driven by the Tool's Spec

## Goal

The mapping editor asks the user to pick between "Option (--flag value)",
"Flag (present/absent)", "Positional", "Environment variable", and "Piped to
stdin" — CLI-author jargon, fronted by a bare select and a free-text flag
input. The registry already *knows* the tool's real options and positionals
(`ToolSpec`, ticket 53); the editor should lead with those instead of making
the user re-type them. Rebuild the "On the command line" sub-section (frame
from ticket 64) so mapping a field is **picking from what the tool actually
accepts, described in plain words**.

## Acceptance criteria

### 1. Spec-first mapping picker

- When the wizard's chosen tool has a `ToolSpec`, the mapping section leads
  with a searchable select of the tool's **actual options and positionals**:
  each entry shows the flag spelling(s) + its help-text description
  (`-w, --width — output width in pixels`). Picking one auto-fills the
  mapping: kind (`option` for `takesValue`, `flag` otherwise, `positional`
  for positionals), flag token, and `repeat` from `repeatable` — and, on a
  fresh field, suggests the Label/help text from the option's description.
- A **"Custom…"** escape hatch keeps today's manual controls for tools
  without a spec, unlisted flags, env vars, and stdin — nothing becomes
  impossible, it just stops being the front door.

### 2. Plain-language framing

- The section is phrased as a sentence, not a taxonomy. Kind names and
  helper copy in user terms:
  - option → *"Passed as `--width <value>`"*
  - flag → *"Adds `--verbose` when checked"*
  - positional → *"Passed as the Nth bare argument"*
  - env → *"Set as the environment variable `WIDTH`"*
  - stdin → *"Typed content is piped into the tool"*
- The live per-field translation cell (ticket 61's `describeFieldMapping`)
  sits directly under the picker as the always-visible result: change
  anything, watch the `--width <Width>` rendering update.
- The `--flag value` vs `--flag=value` style and repeat toggles only appear
  when they apply (option kind), tucked under a small "advanced" reveal —
  they're noise for everyone else.

### 3. Type inference nudge

- Picking a spec option whose description implies a file/number (heuristics:
  "file", "path", "directory" → file; "number", "count", "pixels", "seconds"
  → number) pre-sets the field's input type accordingly on fresh fields —
  editable as ever, never overriding a type the user already changed.

## Files to modify

- `src/mainview/components/CommandFieldsEditor.tsx` (mapping sub-section)
- `src/mainview/components/NewFormPage.tsx` (pass the selected tool's
  `ToolSpec` down to the editor)
- `src/shared/command.ts` (only if `describeFieldMapping` phrasing needs the
  plain-language pass too)

## Edge cases

- Tool with no spec (registered bare / inspection declined): the section
  opens directly on the manual controls with the plain-language labels — no
  dead "pick an option" select.
- The same spec option mapped by two fields is allowed but flagged with a
  hint (duplicate flags usually mean a mistake).
- Spec options with multiple spellings (`-o`, `--output`) map using the long
  form when present.

## Note

Part of the step-3 clarity batch (64–66). Depends on 64's card frame.
