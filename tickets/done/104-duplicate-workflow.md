# Ticket 104 — Duplicate Workflow

## Goal

Workflows stay fully **mutable and tunable** — no lifecycle change. But
creating a new workflow that's _similar_ to an existing one currently means
rebuilding it step by step. Add a one-click **Duplicate**: deep-copy an
existing workflow into a new one and drop straight into the editor, so
"make another one like this, but…" is seconds, not ceremony.

## Acceptance criteria

### 1. Entry points

- **Duplicate** action on each row of
  [WorkflowsPage.tsx](../src/mainview/components/workflow/WorkflowsPage.tsx)
  (alongside Run/Edit/Runs/Delete — kebab or inline, matching the row's
  existing action pattern).
- Same action inside
  [WorkflowEditor.tsx](../src/mainview/components/workflow/WorkflowEditor.tsx)
  ("Duplicate" in the editor's header/menu) — tune a copy without losing
  the original you're looking at.
- The ⌘K picker's workflow rows do **not** grow a duplicate affordance —
  keep the picker about running.

### 2. Copy semantics

- Deep copy of the entire definition via
  [store.ts](../src/bun/workflows/store.ts): steps (including nested
  decision/loop/parallel trees), step params, expressions, and triggers.
  New unique id; name = `"<Original> copy"` (dedupe with `copy 2`, `copy
3`, …).
- **Triggers copy as-is, but cannot fire** — there is no per-trigger
  enabled flag in the model; the workflow-level `enabled: false` (next
  bullet) is what keeps a duplicated cron/task-submitted trigger from
  firing alongside the original
  ([triggers.ts](../src/bun/workflows/triggers.ts) already skips disabled
  workflows). Do **not** add a per-trigger flag for this ticket.
- The copy starts **`enabled: false`**; the user enables it when they're
  done tuning (the existing `Workflow.enabled` toggle semantics).
- Run history does **not** copy — the duplicate starts with zero runs.

### 3. Flow

- Duplicating opens the copy in the editor immediately, name field focused
  and pre-selected so the first keystroke renames it. Toast confirms
  ("Duplicated 'Publish pipeline'"), per ticket 74.
- Duplicate is instant and local — no AI call, no dialog. If the user
  wanted a variation drafted by AI, that's the existing wizard's job
  (ticket 92); don't conflate them.

## Files to modify

- `src/bun/workflows/store.ts` (duplicate fn), `src/bun/index.ts` (RPC)
- `src/mainview/components/workflow/WorkflowsPage.tsx`,
  `WorkflowEditor.tsx`, `src/mainview/context/AppContext.tsx` (if the
  editor-opening path needs a hook)

## Edge cases

- Duplicating a workflow whose steps reference since-deleted tasks: copy
  anyway — the editor already has to render dangling `formSlug` refs;
  duplication must not be the thing that blocks.
- Name collision with an existing _user-chosen_ name (not just prior
  copies): keep suffixing rather than failing.
- A workflow mid-run duplicates fine — the copy has no relationship to the
  in-flight run.
- Version pins (ticket 105's `formVersion`, when landed) copy verbatim —
  the duplicate runs the same pinned task versions as the original.

## Note

Vocabulary per ticket 96 ("task"). This ticket is the mutable-workflow
counterpart to ticket 105's versioned tasks; together they're the "cheap to
vary, safe to depend on" pair.
