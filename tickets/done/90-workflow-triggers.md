# Ticket 90 — Workflow Triggers: Manual, Schedule, Form-Submitted

Part of the Workflow epic (79-86). Depends on 79 (model) and 80 (engine).

## Goal

Triggers live **on the workflow, not on forms** — a form never emits into a
workflow implicitly (the event bus died in ticket 85; this is its principled
replacement). V1 trigger types: **manual**, **schedule** (cron-style),
**form-submitted**. Webhook and file-watch are explicit follow-ups.

## Acceptance criteria

### 1. Manual

- A Run button on the workflow (list page + editor, ticket 91/93) starts a
  run via `startWorkflowRun` with trigger info `{ type: "manual" }`.
- Workflows may declare input parameters (simple named text fields, v1);
  the manual trigger prompts for them and they're addressable as
  `{{trigger.params.<name>}}`. Zero params → no prompt.

### 2. Schedule

- Cron-style expression on the trigger, evaluated **while the app is
  running only** — document this limitation in the trigger editor UI copy
  and `docs/workflow-schema.md` ("no daemon; missed fires don't back-fill",
  matching the existing scheduler's philosophy).
- Implement alongside/like [scheduler.ts](../src/bun/scheduler.ts): compute
  next fire time per enabled workflow with a schedule trigger, re-arm after
  fire and on workflow save/enable/disable. A tiny vendored cron parser or
  minimal subset (`m h dom mon dow`, numbers/`*`/`,`/`-`/`/`) — document
  what's supported.
- Disabled workflows never fire.

### 3. Form-submitted

- Trigger config references a form by slug. When a **standalone** run of
  that form completes (v1: successfully), every enabled workflow with a
  matching form-submitted trigger starts, with the triggering run's data as
  the payload: `{{trigger.inputs.<fieldId>}}`, `{{trigger.stdout}}`,
  `{{trigger.exitCode}}`, `{{trigger.outputs.<name>}}` (ticket 86
  definitions).
- Hook point: the run-completion path in
  [execute.ts](../src/bun/runner/execute.ts)/[index.ts](../src/bun/index.ts)
  — **only** for user/scheduler-initiated form runs; form steps executed
  _inside_ a workflow run never trigger other workflows (no cascades, v1).
- **"Starts workflows" on the form itself**: the form card's expanded body
  ([FormCardBody.tsx](../src/mainview/components/FormCardBody.tsx), where
  FlowInfo used to live) and the FormsPanel row show every workflow that
  uses this form as a trigger — the answer to "what happens if I hit
  submit?" is always visible. Empty → nothing rendered.

## Files to modify

- New: `src/bun/workflows/triggers.ts` (schedule arming + form-submitted
  index, rebuilt on workflow changes)
- `src/bun/index.ts`, `src/bun/runner/execute.ts` (completion hook)
- `src/shared/types.ts` (Trigger union + params)
- `src/mainview/components/FormCardBody.tsx`, `FormsPanel.tsx`
- `docs/workflow-schema.md` (trigger semantics)

## Edge cases

- A form deleted while referenced by a trigger: the trigger shows a
  "missing form" state in the editor; it simply never fires.
- Two workflows triggered by the same form both start (order unspecified);
  each gets its own payload copy.
- Invalid cron expression → validation error at edit time; an invalid one
  persisted anyway (hand-edited file) is reported once at load and never
  fires.
- Acceptance from the spec, verified explicitly: **a form with no trigger
  attachments never starts a workflow when submitted.**

## Note

The form-submitted trigger fires on _completion_ (so outputs exist), not at
submit-click — the trigger payload includes outputs, which don't exist
earlier. UI copy should say "when this form finishes running".
