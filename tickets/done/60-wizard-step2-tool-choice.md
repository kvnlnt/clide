# Ticket 60 — Wizard Step 2: Tool Choice & Version-Aware Registry Cache

## Goal

Step 2 becomes **"specify or OK the tool"**: from the goal stated in step 1,
CLIDE presents candidate CLI tools with helpful info drawn from the cached
tool registry — no repeated AI calls for tools it already knows. The user
confirms the single suggestion, picks among several, resolves one by name,
or drags in a custom executable. Inspection results are cached per tool
**and per tool version**, so the AI only runs again when the binary actually
changed.

## Acceptance criteria

### 1. Candidate presentation

- On entering step 2, candidates are assembled from: registered tools whose
  name/spec matches the goal, plus AI suggestions (`suggestTools`, seeded
  with the step-1 goal, verified installed before display).
- Each candidate renders as a selectable card showing what the registry
  knows: name, one-line description (`ToolSpec.description`), source badge
  (discovered/custom), path, inspected-at. Already-cached info displays
  **without any AI call**.
- One candidate → presented for confirmation ("OK the tool"); several → the
  user picks one; none → the manual affordances below are the path forward.

### 2. Register-on-the-spot

- Choosing an uninspected/unregistered candidate offers inline registration:
  the ticket-53 consent gate (`<path> --help` shown, explicit confirm), then
  capture + AI distillation with the step-1 service/model, then the card
  fills in with the fresh spec. Declining inspection still allows selecting
  the tool bare (manual fields in step 3).
- The manual affordances from old step 1 live here: search registered
  tools, type an executable name/path, and the **drag-and-drop zone** for a
  custom executable (auto-registers as `source: "custom"` via the
  ticket-55/58 flow, then joins the candidate list selected).

### 3. Version-aware inspection cache

- `ToolRegistryEntry` gains a **version fingerprint** captured at inspection
  time: the first line of a `<tool> --version` probe (same safety rails as
  help capture) when one exists, else the binary's size + mtime (or content
  hash for custom copies).
- When a cached entry is selected in step 2 (and on the Settings tools
  list), the current fingerprint is compared: match → cached spec is used
  as-is, **no AI call**; mismatch → the entry is flagged stale ("tool
  changed since inspection") and a consent-gated re-inspection is offered.
  Refusing keeps the stale spec usable, clearly labeled.

## Files to modify

- `src/mainview/components/NewFormPage.tsx`, new step-2 component (absorbing
  what remains of `ToolFinder.tsx`)
- `src/bun/tools/inspect.ts` (version probe), `src/bun/tools/registry.ts`
- `src/shared/types.ts` (fingerprint on `ToolRegistryEntry`), `src/bun/index.ts`,
  `src/mainview/rpc.ts`
- Settings tools section (stale badge — ticket 57's component)

## Edge cases

- `--version` probe hangs or prints nothing → fall back to size+mtime
  fingerprint; never block step 2 on the probe (same hard timeout as help
  capture).
- Existing registry entries (pre-fingerprint) load fine; their first
  selection backfills a fingerprint without forcing re-inspection.
- AI suggestions unavailable (no service/network) → step 2 still fully works
  from the registry + manual affordances.
- The same tool suggested by AI *and* already registered dedupes into one
  card (match on resolved realpath).

## Note

Part of the wizard cleanup batch (57–63); pairs with ticket 59.
