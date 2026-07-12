# Ticket 59 — Wizard Step 1: Goal-First Describe

## Goal

Step 1 of the form-creation wizard
([NewFormPage.tsx](../src/mainview/components/NewFormPage.tsx) +
[ToolFinder.tsx](../src/mainview/components/ToolFinder.tsx)) currently leads
with "Ask what you want to do" and crams tool search/manual-resolve/drop
into the same screen. Rework step 1 to be purely about **stating the goal**:
describe what the form should do, pick the AI service and model, done.
Everything tool-related moves to step 2 (ticket 60).

## Acceptance criteria

### 1. Goal description first

- The top of step 1 is a labeled multiline description box — label along the
  lines of **"What should this form do?"** with instruction text under it
  (e.g. *"Describe the goal in a sentence or two — CLIDE will suggest
  command-line tools and draft the form's fields from this."*).
- This goal text is carried through the wizard: it seeds the tool
  suggestions in step 2 and the field drafting in step 3 (tickets 60/61).

### 2. AI service + model picker second

- The service picker sits below the description.
- **Model becomes a `<select>`, not a free-text field**
  ([ServiceModelPicker.tsx](../src/mainview/components/ServiceModelPicker.tsx)).
  New RPC `listServiceModels { serviceId }` supplies the options:
  - `ollama`: live-query `GET <baseUrl>/api/tags`;
  - `openai-compatible`: live-query `GET <baseUrl>/v1/models`;
  - `anthropic` / `openai`: a curated static list in the main process
    (current production model ids), since those APIs' model lists aren't
    worth a keyed call here.
  - Always include (and preselect) the service's configured `model` /
    kind-default even if the query fails or doesn't list it; query failure
    degrades to that single option, never a broken picker.

### 3. Sections removed

- "Or search registered tools" and "Or type an executable name / path — or
  drag one in" (and the drop zone) leave step 1 entirely — they reappear on
  step 2 per ticket 60. Step 1 renders no tool list.
- Proceeding to step 2 requires a non-empty goal description (the AI service
  remains optional — no-AI users can still pick a tool manually in step 2).

## Files to modify

- `src/mainview/components/NewFormPage.tsx`
- `src/mainview/components/ToolFinder.tsx` (gutted; remainder moves under
  ticket 60)
- `src/mainview/components/ServiceModelPicker.tsx`
- `src/bun/index.ts`, `src/shared/types.ts`, `src/mainview/rpc.ts`
  (`listServiceModels`)

## Edge cases

- No AI services configured: the picker shows its existing hint and step 1
  still proceeds on description alone.
- Ollama/compatible endpoint unreachable → select degrades to the configured
  model with a subtle note, not an error state.
- The goal text survives Back/forward navigation between steps unchanged.

## Note

Part of the wizard cleanup batch (57–63). Pairs with ticket 60 — land 59
and 60 together or in that order, since 59 removes the only tool-picking UI
until 60 restores it on step 2.
