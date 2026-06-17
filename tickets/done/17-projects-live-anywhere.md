# Ticket 17 — Projects Live Anywhere (Folder-Picker-Only Creation)

## Goal

Projects must be able to live in **any folder anywhere on disk**. Today the
"New project" form still has a "Create new folder" mode that silently dumps the
project into CLIDE's default projects directory — projects effectively get boxed
into the clide projects folder. Kill that. Creating a project is just: name it,
pick a folder, hit Create.

Three concrete fixes:

1. **Folder picker only.** Remove the "Create new folder" vs. "Use existing
   folder" toggle entirely. The only way to set a project's location is the
   native folder picker, and the project lives exactly where the user picks —
   anywhere on disk. No default-projects-dir fallback in the UI.
2. **Show the picked path.** After the user selects a folder, display the full
   selected path so they can verify it's correct before creating.
3. **Required fields + correct enablement.** Both the project name and the
   folder are required. The **Create** button stays disabled until both a
   non-empty name and a folder are present; selecting a folder (with a name
   already typed) enables it.

## Background

- Project creation flow: sidebar "New project" form
  ([Sidebar.tsx](../src/mainview/components/Sidebar.tsx)) → `createProject`
  ([AppContext.tsx](../src/mainview/context/AppContext.tsx#L176)) →
  `api.addProject` ([rpc.ts](../src/mainview/rpc.ts#L92)) → `addProject` RPC
  handler ([index.ts](../src/bun/index.ts#L198)) → on-disk `addProject`
  ([config.ts](../src/bun/config.ts#L64)).
- Ticket 16 ([done/16](done/16-project-management-cleanup.md)) added the
  `new`/`existing` mode toggle. In `new` mode the form submits with `path =
  undefined`, and `addProject`
  ([config.ts](../src/bun/config.ts#L72-L75)) falls back to
  `join(defaultProjectsDir(), folderName)`. **That fallback branch is the bug
  this ticket targets** — it's why projects end up inside the clide projects
  folder.
- The `existing`-mode UI in [Sidebar.tsx](../src/mainview/components/Sidebar.tsx#L156-L187)
  already does exactly what we want for all projects: native picker via
  `api.chooseDirectory`, selected path shown (basename emphasized + full muted
  path with `title`), **Change** affordance. This becomes the only mode.
- The picker is the existing `chooseDirectory` RPC
  ([index.ts](../src/bun/index.ts#L341)) → `api.chooseDirectory`
  ([rpc.ts](../src/mainview/rpc.ts#L275)). No new RPC needed.

## Acceptance criteria

### 1. Folder-picker-only creation

- Remove the segmented `folderMode` toggle ("Create new folder" / "Use existing
  folder"), the `folderMode` state, and the `setMode` helper from
  [Sidebar.tsx](../src/mainview/components/Sidebar.tsx).
- The expanded "New project" form is: a **name** input, a **folder selector**
  (always shown), and the **Create** / **Cancel** buttons.
- The folder selector reuses the current existing-mode control:
  - No folder yet → full-width dashed **Choose folder…** button with a
    `FolderOpen` icon.
  - Folder chosen → row with basename emphasized, full path muted/truncated
    (`title={path}`), and a **Change** affordance to re-open the picker.
  - Disabled while a dialog request is in flight (`browsing`) to prevent
    double-opening; cancelling the dialog leaves the current selection
    unchanged.
- `createProject` / `api.addProject` is **always** called with the picked
  absolute `path` — never with `undefined` — so a project is created exactly at
  the chosen folder.

### 2. Show the selected path + reveal-in-Finder link

- After selection, the full chosen path is visible in the form (muted,
  truncated with full value on `title` hover) — same presentation as today's
  existing-mode selected state. The user can read the path back before
  committing.
- Alongside the selected path, add a small **Show containing folder** link/button
  (Lucide `FolderOpen` / `ExternalLink`) that opens the picked folder in the OS
  file manager so the user can confirm it's the right place. This reuses the
  existing `openFolder` RPC ([index.ts](../src/bun/index.ts) handler,
  `api.openFolder` in [rpc.ts](../src/mainview/rpc.ts)) added in ticket 16 — no
  new API. Only shown once a folder is selected; if `openFolder` returns `false`
  it's a no-op (no crash).

### 3. Required fields + button enablement

- Name is required (non-empty after trim) and folder is required.
- **Create** is disabled unless **both** a trimmed name and a selected `path`
  are present. Picking a folder with a name already entered enables it; clearing
  the name disables it again.
- `submitNewProject` validates both and surfaces an inline error if either is
  missing (rather than silently proceeding).
- `resetForm` clears `name`, `path`, and `error` (drop the `folderMode` reset).

## Data / API changes

None. `chooseDirectory`, `addProject`, and `createProject` signatures are
unchanged — this is a UI-side change that always supplies the absolute path that
`addProject` already accepts.

## Backend note (no required change, but verify)

- `addProject` ([config.ts](../src/bun/config.ts#L64)) keeps the
  empty-path → `defaultProjectsDir()` fallback because
  `createDefaultProject` ([config.ts](../src/bun/config.ts#L127)) relies on it.
  That path is now only reachable from the auto-created "Default" project, never
  from the New-project UI. Leave the fallback in place; just stop the UI from
  ever hitting it.

## Files to modify

- `src/mainview/components/Sidebar.tsx` — remove the mode toggle / `folderMode`
  state / `setMode`; always render the folder selector; require name + folder;
  fix Create-button `disabled` logic; update `resetForm` and `submitNewProject`.

## Edge cases

- **No folder selected**: Create disabled; submit impossible.
- **Name empty, folder picked** (or vice-versa): Create disabled; inline error
  on attempted submit.
- **Picker cancelled**: selection unchanged, no error.
- **Already-registered folder picked**: `addProject` dedupe returns the existing
  project — surface without throwing (current behavior).
- **Dialog/RPC unavailable in HMR**: `chooseDirectory` returns `null`, no folder
  is set, Create stays disabled — no crash, no silent default-dir project.

## Out of scope

- Removing the `defaultProjectsDir` fallback from `addProject` end-to-end (kept
  for `createDefaultProject`).
- Moving/relocating an existing project's folder after creation.
