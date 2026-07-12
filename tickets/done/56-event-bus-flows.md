# Ticket 56 — Event-Bus Flows: Artifacts & Payload Mapping

Part of the CLI-first re-envisioning epic (52–56). Depends on 52
(command-backed runs). Builds on the existing bus (ticket 23) and magic
fill (ticket 24).

## Goal

Composition in CLIDE is the **event bus, not shell pipes**: each form does
one thing well, and flows are modeled by forms emitting events that other
forms listen for — synchronous chains (each hop lands in the thread as it
runs) and asynchronous fan-out alike, accumulating inputs and **artifacts**
along the way. The bus exists ([bus.ts](../src/bun/events/bus.ts)); this
ticket makes its payloads carry artifacts and its input-passing
deterministic, so flows are dependable rather than AI-best-effort.

## Acceptance criteria

### 1. Artifacts in payloads

- `BusEvent.payload` grows `artifacts: string[]` — file paths produced by
  the emitting run. Sources: the run's saved output file (`outputPath`)
  and/or file paths the run printed (detection rule kept simple and
  documented — e.g. existing absolute paths on their own stdout line).
- Payloads (text / parsed JSON / artifacts) are what "piping" moves: a
  convert-image form emits `image:converted` with the output file path; an
  upload form listening for it receives that path as an input.

### 2. Deterministic payload → field mapping

- A listening form can declare, per field, where its value comes from in
  the triggering event: the payload text, a JSON path into `payload.json`,
  or an artifact (first/nth). Extends ticket 52's field mapping; authored in
  the wizard's events step (ticket 54).
- Mapped fields fill **without an AI call**; magic fill (ticket 24) remains
  the fallback for unmapped fields. Mapping failures (missing JSON path, no
  artifact) leave the field empty and visible, not silently wrong.

### 3. Flow visibility

- A card whose run was event-triggered already shows its trigger
  (`triggeredBy`); extend the card to link back to the source run and show
  the received artifacts, so a chain reads as a chain when scrolled in the
  thread.
- Emitted-event names and their listener counts show on the form card
  (e.g. "emits image:converted → 2 listeners"), making dead wiring obvious.

### 4. Bus semantics kept honest

- Existing guards stay: hop limit (`MAX_HOPS`), listener index rebuild on
  form changes, per-project scoping as it behaves today (document it in the
  ticket-00 overview if it's cross-project).
- Artifact paths are passed by reference — no copying; a listener reading a
  path the source deleted fails at its own run time with a normal error.

## Files to modify

- `src/bun/events/bus.ts`, `src/bun/runner/execute.ts` (artifact
  collection at emit time)
- `src/shared/types.ts` (payload + field-mapping types)
- `src/bun/ai/magicFill.ts` (skip deterministically-mapped fields)
- `src/mainview/components/FormCard*.tsx` (trigger link, artifacts,
  emits/listeners display)
- Wizard events step (ticket 54's components)

## Edge cases

- Emitting run produced no output file and printed no paths → `artifacts`
  is empty; listeners mapped to an artifact get the visible-empty behavior.
- JSON path mapping against non-JSON output → empty field, tooltip says why.
- Cycles are already hop-limited; a form listening for an event it also
  emits must not tight-loop within one chain.
- Two listeners on one event each get the same payload (fan-out), and the
  thread shows both hops.
