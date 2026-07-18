# Ticket 85 — Remove the Event Bus (Emits / Listens-For)

## Goal

Automation will be approached in a completely different way (workflow/
pipeline layer, tickets 86-87 lay groundwork). Remove the internal event bus
and every trace of the emits/listens-for concept — runtime, data model,
authoring, and display. This supersedes tickets 23 (bus), 24's event-fill
path, and 56 (artifacts/payload mapping) — pure prompt-based magic fill
stays.

## Acceptance criteria

### 1. Runtime removal

- [bus.ts](../src/bun/events/bus.ts) is deleted: `publishRunEvents`,
  listener index, hop tracking, `resolvePayloadMapping`, auto-submit — all
  of it.
- [execute.ts](../src/bun/runner/execute.ts): no event publishing after a
  successful run; `collectArtifacts` (which only fed bus payloads) goes too.
- [index.ts](../src/bun/index.ts): the `setAutoSubmitHandler` block,
  `rebuildListenerIndex` calls, and `registerHop` usage are removed;
  `pushFormsChanged` no longer rebuilds any listener index.
- [magicFill.ts](../src/bun/ai/magicFill.ts): the event-payload context path
  is removed; magic fill is prompt-only. The `fillMagicFields` RPC loses its
  `payload` param.

### 2. Data model removal

- [types.ts](../src/shared/types.ts): delete `FormEvents`,
  `FormDefinition.events`, `RunTrigger`, `RunRecord.triggeredBy`,
  `PayloadMapping`, `MagicField.payloadMapping`; `MagicField.source`
  collapses to prompt-only (drop the field).
- The `createCommandForm` RPC loses its `events` param;
  [loader.ts](../src/bun/forms/loader.ts) **ignores** (not errors on)
  `events` keys in existing `form.json` files — old forms load fine, the
  wiring is simply inert. Same tolerance for `magic.source` /
  `magic.payloadMapping` on disk.
- DB: stop writing `triggered_by`; the column stays (harmless), the
  `RunRecord` mapping for it goes.

### 3. UI removal

- Wizard step 4 loses the Emits / Listens-for tag editors
  ([NewFormPage.tsx](../src/mainview/components/NewFormPage.tsx)); if
  `TagEditor` ([OutputsEvents.tsx](../src/mainview/components/OutputsEvents.tsx))
  has no other consumer, delete it. Step 4 becomes outputs-only (reworked
  further by ticket 87).
- [FormCardBody.tsx](../src/mainview/components/FormCardBody.tsx): the
  `FlowInfo` block (trigger line, artifacts, "emits X → N listeners") is
  removed. [FormCardHeader.tsx](../src/mainview/components/FormCardHeader.tsx):
  the ⚡ trigger indicator and its lookup go.
- Magic-fill sparkles and prompt-based auto-fill on card open are untouched.

## Files to modify

- Delete: `src/bun/events/bus.ts`
- `src/bun/runner/execute.ts`, `src/bun/index.ts`, `src/bun/ai/magicFill.ts`
- `src/shared/types.ts`, `src/bun/forms/loader.ts`, `src/bun/db/history.ts`
- `src/mainview/components/NewFormPage.tsx`, `OutputsEvents.tsx`,
  `FormCardBody.tsx`, `FormCardHeader.tsx`, `src/mainview/rpc.ts`

## Edge cases

- Existing runs with a persisted `triggered_by` row load without error (the
  field is just no longer surfaced).
- Seeded example forms that declare `events` keep loading (ignored keys).
- The legacy script-form generator (`formGenerator.ts`) may still mention
  events in its prompt schema — it's retired from the UI; strip mentions
  opportunistically but don't resurrect the flow to do it.

## Note

Land before 77/78 — freeing step 4 and the `outputs` concept from event
wiring is what makes room for the new output model.
