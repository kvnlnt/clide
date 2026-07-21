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
