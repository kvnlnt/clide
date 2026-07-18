# Ticket 105 — Task Adoption & Versioned Edits

## Goal

Workflows and run history reference tasks by slug — editing a task in place
silently rewrites what every past result and every workflow step _meant_.
Full immutability from birth is too rigid (new tasks need heavy iteration).
So: a task lifecycle. A task starts **draft** (freely editable). After it
has actually been used, the user is offered the choice to **adopt** it
(lock v1). From then on, "editing" is really **copy-to-new-version** — old
versions, old results, and old workflows stay exactly as they were. And at
the moment of such an edit, the user explicitly chooses whether to
**retroactively upgrade** existing workflows to the new version, per
workflow.

## Acceptance criteria

### 1. Lifecycle & model

- `TaskMeta` gains `lifecycle: "draft" | "adopted"` and `version: number`
  (existing tasks migrate to `draft`/`1` on load — loader default, no disk
  migration required).
- **Draft**: today's behavior exactly — edit in place, no versioning, runs
  allowed.
- **Adoption prompt**: after a draft task's first _successful_ run, a
  non-blocking affordance appears on the task's card/panel row: "Adopt
  this task?" with honest copy (adopting locks this version; future edits
  create a new version). Dismissable — it reappears subtly (badge, not
  modal) rather than nagging; the user can also adopt any time from the
  task's menu. Never auto-adopts.
- **Adopted**: the task definition (fields, command mapping, outputs,
  script/config) is read-only. Cosmetic meta (name, description, tags)
  stays editable in place — renaming a task must not fork it.

### 2. Versioned edits

- "Edit" on an adopted task opens the normal wizard/editor **as a new
  version draft** (v N+1), pre-filled from v N. Saving creates the new
  version; canceling leaves no trace.
- Disk layout: versions live inside the task folder —
  `forms/<slug>/versions/<n>/` each holding that version's definition,
  with the folder root (or a `current` pointer in `meta.json`) denoting
  the latest. [loader.ts](../src/bun/forms/loader.ts)/[writer.ts](../src/bun/forms/writer.ts)
  own the layout; versionless folders load as v1 forever (compat). A
  version folder holds that version's **complete** definition,
  engine-blind — including native config blobs (ticket 99's
  `browser.json`).
- **References resolve to a pinned version**: the form/task step in
  [types.ts](../src/shared/types.ts) gains a version pin (absent =
  v1/legacy); `RunRecord` records the version it executed. Naming follows
  ticket 96's disk convention: memory says `TaskStep.taskVersion`, the
  workflow JSON on disk writes `formVersion` (beside `formSlug`), and
  `history.db` gets a `form_version` column. Slug alone (⌘K, drafts,
  schedules) means **latest version**.
- The new version starts in `draft` lifecycle itself (iterate freely),
  with the same adoption flow. Old versions are permanently adopted.

### 3. Retroactive upgrade choice

- On saving version N+1, if any workflows reference the task at ≤ N, show
  an **upgrade dialog**: each referencing workflow listed with a checkbox
  (with per-step detail when a workflow uses the task in multiple steps),
  "Select all" for the wholesale case, and "Skip" to upgrade nothing.
- Checked workflows get their `formVersion` bumped; unchecked keep running
  the old version untouched. The dialog warns inline when the new version
  changed fields/outputs that a workflow's expressions reference
  (`{{steps.x…}}` mismatch detection — best effort, advisory).
- The same upgrade action is available later per-workflow in the editor
  (a step showing "v2 available ↑" affordance) — the save-time dialog is
  a convenience, not the only door.

### 4. Surfaces

- Task cards/rows show the version (`v2`) and lifecycle state (draft
  badge vs a subtle lock glyph) — FormsPanel rows, wizard tool/task
  pickers, workflow editor step cards
  ([WorkflowEditor.tsx](../src/mainview/components/workflow/WorkflowEditor.tsx)).
- A version history view on the task (panel row expansion or menu item):
  versions, created dates, which workflows pin each — old versions are
  viewable read-only, and a "make this latest" escape hatch creates a new
  version copied from an old one (rollback without mutation).
- Deleting a task warns when _any_ version is pinned by a workflow.

## Files to modify

- `src/shared/types.ts`, `src/bun/forms/loader.ts`, `writer.ts`,
  `src/bun/index.ts` (version-aware RPC), `src/bun/workflows/engine.ts` +
  `store.ts` (resolve pinned versions), `src/bun/db/history.ts`
  (+ additive `form_version` column, migrations.ts)
- `src/mainview/components/FormsPanel.tsx`, `FormCard*`, wizard entry
  ("edit" path), `workflow/WorkflowEditor.tsx`, new `UpgradeWorkflowsModal.tsx`,
  new `TaskVersionHistory` surface

## Edge cases

- Scheduled runs pinned to a specific version keep it; schedules created
  against "latest" pick up new versions — state which at schedule-creation
  time.
- Magic fill, output definitions, and AI summaries all operate on the
  _version that ran_ — thread cards for old runs must render old field
  labels correctly (they already store inputs; ensure definition lookups
  are version-aware).
- A draft task referenced by a workflow (possible today) that then gets
  edited: unchanged behavior — versioning discipline only starts at
  adoption. The audit page (ticket 106) can flag "workflow depends on a
  draft task" as a finding.
- Version explosion: the history view is the pressure valve — no cap, but
  unreferenced old versions may offer a "prune" in a future ticket, not
  this one.

## Note

Vocabulary per ticket 96. File paths above are pre-rename — after 96 read
`src/bun/forms/` as `src/bun/tasks/`, `FormsPanel` as `TasksPanel`,
`FormCard*` as `TaskCard*`. Pairs with 104 (mutable workflows, versioned
tasks). Ticket 106's AI proposals lean on this — "edit task X" proposals
materialize as new versions.
