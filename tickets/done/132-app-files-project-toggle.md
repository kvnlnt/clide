# Ticket 132 — App-Level Files View: Project Toggle & Task I/O Story

## Goal

The Files view in app Settings can show everything — app-level *and*
project locations — behind a toggle that keeps the two visually
separate. And the "can tasks/workflows do I/O against app-level
locations?" question gets a definitive, surfaced answer.

## Acceptance criteria

### 1. Show/hide project files from the app view

- [FilesPage.tsx](../src/mainview/components/files/FilesPage.tsx) is one
  shared component instanced twice — app-scoped from
  [SettingsPanel.tsx](../src/mainview/components/SettingsPanel.tsx),
  project-scoped from [App.tsx](../src/mainview/App.tsx) — each
  hardcoded to one scope via the registry split in
  [registry.ts](../src/bun/vfs/registry.ts) (`listAppLocations()` vs
  `listProjectLocations()`).
- The app-scoped instance gains a toggle to include project locations
  (across all registered projects), grouped/labelled by project so app
  vs. project files stay visually distinct. The project-scoped instance
  is unchanged.

### 2. App-level files available to tasks/workflows

- Investigation first: `getLocation()` already resolves app-scoped
  locations regardless of project context, and the `vfs*` RPCs plus
  [artifacts.ts](../src/bun/runner/artifacts.ts) file-association
  snapshotting go through it — so app-level I/O may already work
  end-to-end. Verify with a real task run against an app-level
  location.
- Whatever the finding: make it *surfaced* — app-level locations appear
  wherever a task/workflow picks a file location, and the gap (if any)
  is closed. Document the outcome in the ticket's Implementation notes.

## Files to modify

- `src/mainview/components/files/FilesPage.tsx`,
  `src/bun/vfs/registry.ts` (cross-project listing), possibly
  `src/shared/types.ts` / `src/bun/index.ts` for a combined-listing RPC
- Task/workflow location pickers if app-level locations aren't offered
  there today

## Implementation notes

### 1. Project toggle (done)

`FilesPage.tsx`'s app-scoped instance gained an "Include project files"
checkbox. When on, it fetches `api.listAllProjectVfsLocations()` (new RPC,
backed by `registry.listAllProjectLocations()`, which iterates
`listProjects()` and reads each project's `vfs.json`) alongside the existing
app-scoped `listVfsLocations()` call, and renders both lists grouped under
an "App" header and one header per project name — visually separated by a
border + tinted background on each project group's header row. Every
location the sidebar knows about is now a `{ location, projectName? }` pair
(`projectName` unset for true app locations), which also fixed a latent
bug: browsing/searching/opening/removing a *project*-scoped location shown
in the app view now passes that location's own project to the `vfs*` RPCs
instead of the app view's (always-undefined) project — required for those
calls to resolve the location at all via `getLocation(id, projectPath)`.
The project-scoped instance (`App.tsx`) is unchanged — same filtering,
same behavior.

### 2. App-level task/workflow I/O (verified, no gap)

Traced and then verified end-to-end (via a script exercising the real
`registry.addLocation` → `getLocation` → `artifacts.snapshotAssociatedLocations`
→ `artifacts.diffSnapshots` code path, isolated under a throwaway
`CLIDE_PROFILE` so it never touched real app data) that an app-scoped VFS
location works fully for a task whose *own* project is unrelated:
`getLocation(id, projectPath)` checks app-scoped locations first regardless
of the `projectPath` passed in, so every `vfs*` RPC and the artifact
snapshot/diff pair in `artifacts.ts` already resolve and detect files in
app-level locations correctly, with no special-casing needed. **No gap to
close here** — this was already correct from ticket 102 onward.

### 3. Task/workflow location pickers — a different, pre-existing gap

Went looking for "wherever a task/workflow picks a file location" to make
sure app locations are offered there, and found there currently **is no
such picker anywhere in the app**. `TaskDefinition.fileAssociations`
(the thing `artifacts.ts` reads) is parsed from `meta.json` by the loader
but nothing in `src/mainview` ever writes it — no editor, no picker, no
reference to it outside the backend and this ticket. The `"file"` field
type in `TaskField.tsx` is an unrelated plain-text path input, not a VFS
location picker. So the finding isn't "app locations are missing from an
existing picker" — it's that the picker itself doesn't exist yet for
*any* scope. Building that editor is a distinct feature (UX for
attaching one or more VFS locations + optional glob pattern to a task)
that wasn't part of this ticket's brief and needs its own design pass, so
it's been flagged as a follow-up rather than built speculatively here.
