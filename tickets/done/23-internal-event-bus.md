# Ticket 23 — Internal Event Bus: Emit on Completion, Auto-Submit Listeners

## Goal

Wire up the event declarations captured in ticket 22. When a run completes
successfully, its form's `events.emits` fire on an **in-app event bus** (Bun
main process). Forms whose `events.listensFor` matches an emitted event are
**auto-submitted**, with the emitting run's output available as the event
payload (consumed by magic fields in ticket 24).

Events are internal to CLIDE only — no webhooks, no external IPC.

## Background

- Runs finish in [execute.ts](../src/bun/runner/execute.ts) — `finish()` sets
  status success/error and calls `emitters.emitStatus(...)`
  ([execute.ts](../src/bun/runner/execute.ts#L144-L146)). This is the emission
  hook point.
- The scheduler ([scheduler.ts](../src/bun/scheduler.ts)) already demonstrates
  Bun-side triggering of runs without user interaction (`TriggerRun`).
- `resolveFormProject` ([loader.ts](../src/bun/forms/loader.ts)) maps slugs to
  project paths; listeners may live in **any registered project** (event bus is
  app-wide, not per-project — cross-project pipelines are the point).
- Run output files are captured by
  [outputCapture.ts](../src/bun/runner/outputCapture.ts); the run's stdout is
  the natural payload body.

## Concept

```ts
/** A fired event travelling the in-app bus. */
interface BusEvent {
  name: string; // e.g. "media:created"
  /** Emitting context. */
  sourceRunId: string;
  sourceFormSlug: string;
  /** stdout of the emitting run, plus parsed JSON when outputType is json. */
  payload: { text: string; json?: unknown };
  timestamp: number;
}
```

New module `src/bun/events/bus.ts`: subscribe/emit, plus a
`registerFormListeners()` pass that (re)builds the event→forms index from
loaded forms (re-run on forms change, same trigger as `watchForms`).

## Acceptance criteria

### 1. Emission

- When a run finishes with status `success` and its form declares
  `events.emits`, one `BusEvent` per name is emitted with the run's stdout as
  payload (`json` populated when the form's primary output kind is `json` and
  stdout parses).
- Failed/cancelled runs emit nothing.

### 2. Auto-submission

- Every form (across all registered projects) whose `listensFor` includes the
  emitted name is submitted via the existing run pipeline (`startRun`), like a
  scheduler trigger: a real `RunRecord`, streaming output, thread card — no
  special casing in the renderer.
- Inputs for the auto-submitted run: all fields empty/defaults for this
  ticket, **except** the event payload is stored on the run so ticket 24 can
  feed magic fields. Add `triggeredBy?: { event: string; sourceRunId: string }`
  to `RunRecord` (nullable, persisted in history).
- **Cycle guard**: an auto-submitted run carries a hop counter; events emitted
  by runs at hop ≥ 3 do not trigger further auto-submissions (logged to
  console). Direct self-loops (form listens for what it emits) are refused at
  emission time.

### 3. Visibility

- Auto-submitted runs render in the thread like any run. The form card header
  shows a small bolt/zap affordance with tooltip
  "Triggered by <event> from <form name>" when `triggeredBy` is set
  ([FormCardHeader.tsx](../src/mainview/components/FormCardHeader.tsx)).

### 4. Lifecycle

- Listener index rebuilds whenever forms change (hook into the same paths that
  call `pushFormsChanged` in [index.ts](../src/bun/index.ts)).
- Bus is in-memory only; no persistence or replay. App restart = clean slate.

## Out of scope

- Magic-field consumption of payloads (ticket 24) — payload is only stored.
- External event sources/sinks (webhooks, files, IPC).
- Event history/inspector UI.

## Files to modify

- New `src/bun/events/bus.ts` — bus + listener index + cycle guard.
- `src/bun/runner/execute.ts` — emit on successful finish.
- `src/bun/index.ts` — wire bus to forms lifecycle + auto-submit trigger.
- `src/bun/db/history.ts` + `src/shared/types.ts` — `RunRecord.triggeredBy`
  (+ migration in [migrations.ts](../src/bun/db/migrations.ts)).
- `src/mainview/components/FormCardHeader.tsx` — triggered-by affordance.

## Edge cases

- Listener form's project unregistered mid-flight → skip silently.
- Multiple listeners for one event → all fire, order unspecified.
- Emitting form deleted between finish and emission → still emits (event
  carries only slug/name strings).
