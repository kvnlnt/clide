# Ticket 54 — Form Creation Wizard: Chat-Assisted, Manually Tunable

Part of the CLI-first re-envisioning epic (52–56). Depends on 52 (command
model) and 53 (registry/inspection). **Supersedes the script-generation
creation flow** (tickets 10/22 — describe → AI-drafted spec → generated
script): [NewFormPage.tsx](../src/mainview/components/NewFormPage.tsx) is
rebuilt around commands, and
[formGenerator.ts](../src/bun/ai/formGenerator.ts)'s script generation is
retired from the flow (code may remain for legacy forms).

## Goal

Creating a form should feel like a **wizard the user is always in charge
of**, with AI as an accelerant at every step — never a gate. The AI drafts;
the user fine-tunes; any step works fully manually if the AI is skipped,
unconfigured, or wrong. The wizard produces a command-backed form (ticket
52) that does *one thing well*.

## Acceptance criteria

### 1. Step: Find the tool

- A **chat-style panel**: the user describes what they want to do ("resize
  images", "convert video to gif") or names a tool directly.
- A **service + model picker** scoped to this wizard session: choose any
  configured AI service (ticket 45) and override its model. Persisted as the
  session default; shown, not buried.
- The assistant can: suggest candidate tools (registered ones first, then
  common tools it believes are installed — verified via `resolveTool` before
  being offered), and trigger inspection (ticket 53, with its consent gate)
  on the chosen one.
- **Manual path**: a plain searchable list of registered tools + a "type an
  executable name" input that resolves against PATH. No AI service
  configured → the chat panel degrades to this gracefully, with a hint.

### 2. Step: Scope the action

- Pick the *one thing* this form does: a subcommand (from the ToolSpec) or
  the bare tool, plus any fixed base args. One form = one action; the UI
  copy should say so.
- Name + description drafted by AI from the choice, editable.

### 3. Step: Fields

- AI drafts a field set from the `ToolSpec` for the scoped action: each
  field typed (text/number/select/file/date/boolean-flag), labeled, mapped
  to its flag/positional/env/stdin per ticket 52's mapping.
- Full manual control over the draft: add/remove/reorder fields, change
  types, labels, defaults, required, arg mapping — the existing field-editor
  patterns from the spec flow apply.
- **Live command preview** (ticket 52's serializer) pinned in view, updating
  as fields and sample values change — the user always sees the command
  their form will run.

### 4. Step: Output & events

- Declare output kind(s) (existing `OutputSpec`) and event wiring
  (`emits` / `listensFor`), same semantics as today's bus (ticket 23);
  deeper flow features arrive in ticket 56.
- Finish writes the form folder (`form.json` + `meta.json`, no script file)
  via [writer.ts](../src/bun/forms/writer.ts) and lands the user on the
  thread with the new form ready to run.

### 5. Editing

- "Edit form" on an existing command-backed form (FormsPanel / card menu)
  reopens the same wizard populated from disk — creation and management are
  one surface. Legacy script forms keep their current read-only/meta-edit
  behavior.

## Files to modify

- `src/mainview/components/NewFormPage.tsx` (rebuild)
- New: wizard step components (`ToolFinder`, `FieldMappingEditor`,
  `CommandPreview`, …) under `src/mainview/components/`
- `src/bun/ai/formGenerator.ts` → new draft-fields-from-ToolSpec entry point
- `src/bun/index.ts` (RPC for chat/draft calls)
- `src/mainview/components/FormsPanel.tsx`, `FormCardMenu.tsx` (edit entry)

## Edge cases

- AI drafts a flag that doesn't exist in the help text — the user can
  delete/correct it; the preview makes the error visible before first run.
- Tool with no subcommands and no help output — wizard still works: manual
  fields over a bare executable.
- Abandoning the wizard mid-way writes nothing to disk.
- Chat requests fail (no key, network) → inline error in the chat panel;
  every step still completable manually.

## Note

Keep the page full-width (ticket 49 conventions). The wizard is the epic's
centerpiece: 55 feeds it custom tools, 56 extends its events step.
