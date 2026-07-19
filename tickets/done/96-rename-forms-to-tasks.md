# Ticket 96 — Rename "Form" → "Task" (Product-Wide)

## Goal

The core domain object currently called a **form** is renamed to a **task**
everywhere the product speaks: UI copy, menus, shortcuts, tooltips, toasts,
empty states, wizard copy, docs, and marketing. This is **purely a rename**
— zero behavior changes. Users "create a task", "run a task", browse the
"Tasks" panel, and search tasks in ⌘K.

Source filenames, component names, types, and module paths follow the
rename so the codebase doesn't teach the old word to every future ticket.

## The one landmine

"Form" is overloaded: it's both (a) our domain object and (b) the generic
UI notion of an input form. The domain object's _whole point_ is that it
renders as a literal fill-out form — that presentation language may keep
the word "form" where it genuinely means "a set of input fields" (e.g.
"Fill out the form below" is fine; "Create a new form" is not). Every
rename must be judged: **is this the domain object, or a generic input
form?** When in doubt in UI copy, prefer "task".

## Acceptance criteria

### 1. UI copy sweep

- All user-visible strings that mean the domain object say "task"/"Tasks":
  FormsPanel title & empty states, "New form…" / "Create new form" actions,
  the ⌘K Run picker section headers and create buttons ("New task…"),
  native **View menu** labels, welcome screen copy, wizard headers/steps,
  Settings, calendar composer ("pick a task"), toasts, confirm dialogs,
  view filter labels ("Forms" filter chip → "Tasks"), tooltips, and
  placeholder text.
- Keyboard shortcuts keep their current bindings (⌘P etc.) — only the
  labels describing them change.

### 2. Code identifiers & filenames

- Renderer components: `FormCard*` → `TaskCard*`, `FormsPanel` →
  `TasksPanel`, `NewFormPage` → `NewTaskPage`, `FormPreview` →
  `TaskPreview`, `FormField` → `TaskField`, `useFormSearch` →
  `useTaskSearch`, `types/forms.ts` → `types/tasks.ts`.
- Shared types ([types.ts](../src/shared/types.ts)): `FormDefinition` →
  `TaskDefinition`, `FormMeta` → `TaskMeta`, `CreateFormInput` →
  `CreateTaskInput`, RPC method names (`listForms` → `listTasks`, etc.).
  Bun side: `src/bun/forms/` → `src/bun/tasks/`, `formGenerator` →
  `taskGenerator`, `RunRecord.formSlug` → `taskSlug`, workflow trigger
  `form-submitted` → `task-submitted` (see §4 for disk compat).
- Exceptions — do **not** rename generic uses: `ScheduleSubForm` (a literal
  sub-form of inputs; rename only if it reads confusing after the sweep),
  HTML `<form>` elements, and comments that mean "an input form".
- `bunx tsc --noEmit` and `bunx vite build` pass after the rename (mind
  `noUnusedLocals`).

### 3. Docs & site

- [README.md](../README.md), [llms.txt](../llms.txt),
  [docs/index.html](../docs/index.html), [docs/workflow-schema.md](../docs/workflow-schema.md),
  [scripts/gen-site.ts](../scripts/gen-site.ts), and the intro prose of
  [tickets/00-overview.md](00-overview.md) ("everything is a form" → "everything
  is a task"). Historical ticket files in `done/` are **not** rewritten.
- [scripts/seed-profile.ts](../scripts/seed-profile.ts) seed copy says "task"
  where it means the domain object.

### 4. Disk format: unchanged (compat firewall)

- The on-disk layout (`<project>/forms/<slug>/form.json`, `meta.json`,
  `history.db` columns, workflow JSON `type: "form"` steps with `formSlug`,
  `form-submitted` triggers, and workflow run records) stays
  **byte-compatible** — existing user projects must open without
  migration. The translation boundaries are the task loader/writer **and**
  the workflow store ([store.ts](../src/bun/workflows/store.ts) /
  [runStore.ts](../src/bun/workflows/runStore.ts)): disk says `form`,
  memory says `task` (`TaskStep.taskSlug`, trigger `task-submitted`).
- **Convention for future fields**: any NEW field persisted into these
  same files/tables keeps the disk's `form` vocabulary so each file's
  schema stays self-consistent (e.g. ticket 105 writes `formVersion` in
  workflow JSON and a `form_version` history column while memory says
  `taskVersion`). Brand-new files (`profile.json`, `browser.json`, …) use
  task vocabulary freely.
- Document this explicitly in a comment atop the loader and in
  `workflow-schema.md` ("`form` on disk = task in the product"). A disk
  migration is a possible follow-up ticket, not this one.

## Files to modify

Broad: most of `src/mainview/components/`, `src/mainview/hooks/`,
`src/mainview/context/AppContext.tsx`, `src/shared/types.ts`,
`src/bun/forms/` → `src/bun/tasks/`, `src/bun/index.ts` (RPC + View menu),
`src/bun/ai/`, `src/bun/workflows/`, docs listed above.

## Edge cases

- Grep for `"form"` in string literals _after_ the identifier rename — copy
  hiding in template strings, aria-labels, and error messages.
- Dev profiles (`bun run dev:hmr:<profile>`) still seed and load correctly
  against the unchanged disk format.
- Workflow expression language references (`{{steps.x.form…}}` if any) and
  saved views' form-filter keys must keep matching persisted data.

## Note

Do this rename **before** tickets 97–106 land so they're written in the new
vocabulary (those tickets already say "task"). Where their file lists still
name pre-rename paths (`FormsPanel.tsx`, `src/bun/forms/`, `formGenerator`,
…), read them as the post-rename equivalents.
