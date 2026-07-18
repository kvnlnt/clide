# Ticket 97 — Sidebar Badges = Unread Results (Opt-In Per Project)

## Goal

The number beside a project name in the sidebar becomes a true **unread
results** count: it increments when a run finishes, decrements as the user
views each result, and disappears at zero. Whether a project tracks unread
at all is a **per-project setting** — turning it off clears the badge and
stops tracking (this doubles as the one-move "clear" gesture).

## Current behavior (the bug)

[Sidebar.tsx](../src/mainview/components/Sidebar.tsx) counts
running/pending/scheduled runs (green) or **all error runs ever** (red).
Nothing marks anything as seen, so `bun run dev:beginner`'s red "2" (two
seeded failed runs) never goes away no matter how much you click.

## Acceptance criteria

### 1. Unread model

- A run becomes **unread** the moment it reaches a terminal status
  (`success` or `error`). Runs already terminal at seed/boot time count as
  unread only if never viewed.
- Persist read state in `history.db` via an additive `read_at TEXT NULL`
  column ([migrations.ts](../src/bun/db/migrations.ts) pattern from
  ticket 23) — survives restarts, works per-project since each project owns
  its db.
- `RunRecord` gains `readAt: string | null`; new RPC `markRunsRead(runIds)`
  (batched) and the run list includes read state.
- Workflow runs are **not** in `history.db` — they're JSON records managed
  by [runStore.ts](../src/bun/workflows/runStore.ts). `WorkflowRun` gains
  `readAt?: string | null`; a finished workflow run counts as **one**
  unread item, and its child task runs (identifiable via
  `RunRecord.triggeredBy`) are written pre-read so they never count.
  `markRunsRead` handles both id kinds (or add a sibling
  `markWorkflowRunsRead` — implementer's choice).

### 2. Badge behavior

- Badge shows the project's unread count. Red if any unread is an `error`,
  green otherwise (keeps the existing color language). Zero → no badge.
- Marking read: expanding a run's accordion row
  ([SubmissionAccordionRow.tsx](../src/mainview/components/SubmissionAccordionRow.tsx))
  or expanding a standalone run card marks that run read. The
  auto-opened latest row in
  [SubmissionAccordion.tsx](../src/mainview/components/SubmissionAccordion.tsx)
  counts as viewed **only when the card itself is expanded by the user**,
  not merely rendered in the thread.
- Badge updates live (optimistic decrement in
  [AppContext.tsx](../src/mainview/context/AppContext.tsx), RPC in the
  background).

### 3. Per-project setting

- [ProjectSettingsPage.tsx](../src/mainview/components/ProjectSettingsPage.tsx)
  gains a toggle: **"Track unread results"** (default **on**), with helper
  copy ("Show a badge when runs finish in this project").
- Toggling **off**: badge hides immediately and new terminal runs are not
  tracked. Toggling back **on** starts fresh — everything before the
  toggle-on moment is considered read (no avalanche of stale unread).
- Persist the flag in the app-scoped registry entry for the project
  ([config.ts](../src/bun/config.ts) `projects.json`) so it survives even
  if the project db is rebuilt.

### 4. Still-running indicator

- Decide and implement one: either keep a _separate_ subtle indicator for
  in-flight runs (e.g. a small pulsing dot, no number), or drop the
  running/pending count entirely. The number itself must mean **unread
  finished results** only.

## Files to modify

- `src/mainview/components/Sidebar.tsx`, `SidebarProject.tsx`,
  `SubmissionAccordionRow.tsx`, `SubmissionAccordion.tsx`,
  `ProjectSettingsPage.tsx`, `context/AppContext.tsx`
- `src/shared/types.ts` (RunRecord, WorkflowRun, RPC),
  `src/bun/db/migrations.ts`, `src/bun/db/history.ts`,
  `src/bun/config.ts`, `src/bun/index.ts`
- `src/bun/workflows/engine.ts` + `runStore.ts` (workflow-run `readAt`,
  pre-read child runs)

## Edge cases

- A run finishing **while its card is already expanded and visible** should
  arrive pre-read (don't flash a badge for something the user is watching).
- Workflow runs: covered in §1 — step runs arrive pre-read; the workflow
  run's own unread bit is cleared from the run log (ticket 94 surface) or
  by expanding its thread card.
- Deleting a project / runs must not leave phantom counts.
- Multi-run grouped cards: expanding the group header marks only the rows
  the user actually opens, except the auto-opened latest row (see §2).
