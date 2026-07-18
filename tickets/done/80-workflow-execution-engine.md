# Ticket 80 — Workflow Execution Engine & Run Persistence

Part of the Workflow epic (79-86). Depends on 79 (model, expressions, scope).

## Goal

The Bun-process engine that executes a Workflow: steps run sequentially per
list, parallel steps run concurrently and rejoin, decisions and loops
evaluate via the shared expression module, and every Run persists a full,
auditable trace — the exact resolved command per form step, stdout/stderr,
exit code, durations. **Form steps go through the same
`buildCommand`/execution path standalone submissions use** so preview, dry
run, and execution can never disagree.

## Acceptance criteria

### 1. Execution semantics

- New `src/bun/workflows/engine.ts`:
  - sequential execution per list; **parallel step** branches run
    concurrently (`Promise.all`-style) and rejoin before the next sibling;
  - **decision step** evaluates its condition; the taken branch executes,
    the untaken branch's steps are recorded **skipped with the evaluated
    condition result** so the trace shows why;
  - **loop step** evaluates `over` to a list and executes its sub-list once
    per item (sequentially, v1), `item` bound in scope; each iteration gets
    its own per-step records (indexed names, e.g. `resize[2]`);
  - **form step** resolves its input templates against the run scope, then
    executes through the existing pipeline
    ([execute.ts](../src/bun/runner/execute.ts) / `buildCommand` — factor a
    callable that returns `{argv, stdout, stderr, exitCode, outputs}`
    without duplicating spawn logic). The form's output definitions
    (ticket 77) are evaluated and exposed to later steps as
    `outputs.<name>`.
- **Failure policy v1**: a failed step (nonzero exit, unresolvable
  reference, expression error) halts the workflow; all remaining steps are
  marked **skipped**. Per-step continue-on-error is explicitly a follow-up.

### 2. Run persistence

- One JSON file per Run at `<project>/workflow-runs/<runId>.json`
  (human-readable, consistent with the on-disk philosophy):
  `runId`, `workflowId`, **a snapshot of the workflow definition at run
  time** (or content hash + embedded copy — pick embed: replay needs it),
  trigger info, start/end timestamps, and per-step records.
- Per-step record: step name (with loop index where applicable), status
  (`pending / running / succeeded / failed / skipped`), the **exact
  resolved command string**, stdout, stderr, exit code, duration, and
  resolved input values.
- RPC: `startWorkflowRun`, `listWorkflowRuns { project, workflowId }`,
  `getWorkflowRun { runId }`, `cancelWorkflowRun { runId }`.

### 3. Live streaming

- Step status transitions and output chunks stream to the renderer over the
  existing push-message channel (new `onWorkflowRunUpdate` webview message),
  same mechanics as `onRunStatus`/`onOutputChunk` — this feeds the live
  trace view (ticket 85).

## Files to modify

- New: `src/bun/workflows/engine.ts`, `src/bun/workflows/runStore.ts`
- `src/bun/runner/execute.ts` (factor the reusable single-command runner)
- `src/shared/types.ts` (Run/record types + RPC), `src/bun/index.ts`,
  `src/mainview/rpc.ts`, `src/bun/paths.ts`

## Edge cases

- Cancelling a run kills the currently running step's process(es) —
  including all live parallel branches — and marks the rest skipped.
- A loop over a non-list (or an empty list) → step fails with a readable
  error / succeeds with zero iterations, respectively.
- Two parallel branches finishing with one failure: the join fails the
  workflow, but the *other* branch's completed records are preserved intact.
- Workflow-run form executions do **not** appear as thread cards (they're
  inside the workflow trace); decide and document — v1: they don't, the run
  log is their home.
- App quit mid-run: the run file records whatever completed; on next launch
  in-flight runs are marked failed with "interrupted" (no resume in v1).

## Note

The snapshot-at-run-time requirement is what makes step replay (ticket 86)
honest — replays resolve against the definition that actually ran.
