# Ticket 86 — Workflow Dry Run & Step Replay

Part of the Workflow epic (79-86). Depends on 80 (engine) and 85 (trace UI).
Closes out the epic's testability goals.

## Goal

Two affordances that make workflows trustworthy before and after the fact:
**dry run** — the `terraform plan` analogue showing every command that
*would* execute, resolving what's resolvable and placeholding what isn't,
executing nothing; and **step replay** — re-run one step from a past run
with its captured resolved inputs, without touching upstream steps or the
original record.

## Acceptance criteria

### 1. Dry run

- Engine mode (`dryRun: true` through the ticket-80 entry point, or a
  sibling pure function) that walks the workflow exactly as execution
  would, but:
  - form steps resolve input templates against whatever is statically
    known (trigger params entered for the dry run, literals) and compile
    the command via the same `buildCommand` path; references depending on
    runtime output render as `⟨fetch_rss.outputs.items⟩` placeholders in
    the compiled string;
  - decision steps with statically-resolvable conditions show the branch
    that would be taken; unresolvable ones show **both** branches marked
    "depends on runtime value";
  - loop steps show the sub-list once, annotated "× per item of ⟨expr⟩".
- Rendered in the ticket-85 trace layout (statuses replaced by a "plan"
  glyph) from a **Dry run** button beside Run on the list page and editor.
- **Nothing executes and nothing is persisted** — no run file, no entry in
  the Runs tab. Verified acceptance from the spec.

### 2. Step replay

- On a past run's detail view, each completed-or-failed **form step** row
  offers **Replay** (the ticket-85 action slot): re-executes exactly that
  step using the **captured resolved input values** from the run record
  (no re-resolution, no upstream execution), through the same command
  runner.
- The result renders inline under the row, clearly labeled as a replay
  (timestamp, "replay — does not affect this run"), styled distinct from
  the original record. The original run file is **never mutated**; replays
  are ephemeral view-state (v1 — persisting replay history is a follow-up).
- Replays of decision/loop/parallel structural steps are not offered (only
  form steps execute commands); their rows simply lack the action.
- Confirm dialog (ticket 74) before replaying, since the command has real
  side effects: shows the exact command about to run.

## Files to modify

- `src/bun/workflows/engine.ts` (dry-run walk + single-step replay entry),
  `src/bun/index.ts`, `src/mainview/rpc.ts`, `src/shared/types.ts`
- `src/mainview/components/workflow/WorkflowRunDetail.tsx`,
  `StepTraceRow.tsx` (replay affordance + inline result),
  `WorkflowsPage.tsx` / `WorkflowEditor.tsx` (Dry run button)

## Edge cases

- Dry run of a workflow with validation errors (dangling references) shows
  the errors in place of the plan rather than a misleading partial plan.
- Replaying a step whose form has since been edited or deleted: the run
  snapshot (ticket 80) provides the definition — replay uses the
  *snapshot's* command mapping, and the UI notes when the current form
  differs.
- Replay of a step inside a loop iteration replays that iteration's
  captured inputs specifically.
- A replay that hangs is cancellable like any run (same process registry).

## Note

Dry-run fidelity rests on the single-compiler rule from ticket 80 — preview,
dry run, and execution all call the same `buildCommand`. Don't fork it here.
