# Ticket 85 — Workflow Run Log UI (Live Trace View)

Part of the Workflow epic (79-86). Depends on 80 (run persistence +
streaming) and 84 (the surface it lives on).

## Goal

Full auditability in the UI: every workflow has a **Runs** tab, and a run
detail view reads like a CI trace — one row per step, expandable to the
exact command, stdout/stderr, and resolved inputs, updating **live** while
a run is in progress.

## Acceptance criteria

### 1. Runs list

- From the Workflows page (ticket 84) or the editor, a Runs tab per
  workflow: reverse-chronological, each row showing status (the
  `STATUS_META` visual language, ticket 40), **trigger source** ("manual",
  "schedule", "on Fetch RSS"), start time, and duration. Live-updating row
  for an in-progress run.

### 2. Run detail — CI-style trace

- One row per step record, in execution order, loop iterations as their
  indexed entries (`resize[0]`, `resize[1]`…), parallel branches grouped
  under their step with branch labels:
  - collapsed: status icon, step name, duration;
  - expanded: the **exact resolved command** (mono block, copyable — the
    ticket-52 preview styling), stdout/stderr (via `AutoSizeOutput`,
    ticket 72), and resolved input values (label → value list, the
    ticket-71 `SubmittedSummary` pattern).
- **Skipped steps render grayed**; a skipped decision branch shows the
  evaluated condition and its result ("`items.length > 0` → false") so the
  trace shows *why*. Steps skipped by the halt-on-failure policy say
  "skipped — earlier step failed".
- The currently running step shows a spinner (existing `running` status
  icon); output streams in live via `onWorkflowRunUpdate` (ticket 80), and
  a completed run stops subscribing.
- Header: workflow name, run status, trigger info, total duration, a
  Cancel button while running, and the definition-snapshot notice when the
  workflow has changed since this run ("run used an older version").

### 3. Navigation

- Starting a manual run (list page, editor, or ⌘K per ticket 84) lands on
  the live run detail. Deep-linkable state: `workflowId` + `runId` in
  renderer state (no router — same pattern as surface state).

## Files to modify

- New: `src/mainview/components/workflow/WorkflowRuns.tsx`,
  `WorkflowRunDetail.tsx`, `StepTraceRow.tsx`
- `src/mainview/components/workflow/WorkflowsPage.tsx` (tab hosting)
- `src/mainview/rpc.ts` (subscribe to run updates), `AppContext.tsx`
  (active run view state)

## Edge cases

- Opening a historical run reads the persisted file — identical rendering
  path to the live view (one component, data-source agnostic), so the two
  can't drift.
- Very long stdout in a step row: `AutoSizeOutput` caps + scrolls; the row
  never grows unbounded.
- A run whose workflow was deleted still opens (the snapshot is embedded in
  the run file) — the header notes the workflow no longer exists.
- Cancelled runs render the cancelled step as failed ("cancelled") and the
  rest skipped, matching engine semantics.

## Note

The trace view is also where step replay (ticket 86) mounts its affordance
— leave an action slot on `StepTraceRow`.
