# Ticket 16 — Project Management Cleanup

## Goal

Make the project create/edit/delete flows clearer and safer. Four concrete fixes:

1. Let the user **explicitly choose** "create a new folder" vs. "use an existing
   folder" when adding a project — today the behavior is implicit and confusing.
2. Make **selecting** a folder the only way to set the path (no free-text path
   entry), and replace the **Browse** button with a friendlier, better-looking
   control.
3. **Remove** the "Also delete files from disk" option when deleting a project — it
   is too dangerous. Instead, surface a link that reveals the project folder in
   Finder so the user can delete it themselves.
4. **Show the current folder path** in the project's settings panel.

## Background

- Project creation: sidebar "New project" form
  ([Sidebar.tsx](../src/mainview/components/Sidebar.tsx)) → `createProject`
  ([AppContext.tsx](../src/mainview/context/AppContext.tsx)) → `api.addProject`
  ([rpc.ts](../src/mainview/rpc.ts)) → `addProject` RPC handler
  ([index.ts](../src/bun/index.ts)) → on-disk `addProject`
  ([config.ts](../src/bun/config.ts)).
- The create form today has a free-text **Folder path (optional)** input plus a
  **Browse** button ([Sidebar.tsx](../src/mainview/components/Sidebar.tsx) ~L107-134).
  `addProject` ([config.ts](../src/bun/config.ts)) already handles both cases: a
  supplied absolute `path` is used/created via `ensureProjectDirs`; an empty path
  auto-creates a folder named after the project under the default projects dir. The
  gap is that the UI never makes this either/or choice explicit.
- Project deletion: settings panel
  ([SidebarProjectSettings.tsx](../src/mainview/components/SidebarProjectSettings.tsx))
  → `deleteProject(path, deleteFiles)` → `api.removeProject` → `removeProject`
  ([config.ts](../src/bun/config.ts) L88). When `deleteFiles` is true the handler
  does `rmSync(path, { recursive: true, force: true })` — the dangerous path this
  ticket removes from the UI.
- Native capabilities already available from `electrobun/bun` `Utils`
  (`node_modules/electrobun/dist/api/bun/core/Utils.ts`):
  - `openFileDialog({ canChooseDirectory, canChooseFiles, ... })` — already wired as
    the `chooseDirectory` RPC ([index.ts](../src/bun/index.ts) L341).
  - `openExternal(url)` — opens a URL/path with the system handler; passing a
    `file://` URL reveals the folder in Finder. **Not yet exposed** over RPC.

## Acceptance criteria

### 1. Explicit "new folder" vs. "existing folder" choice

- The create-project form presents a clear two-way choice (e.g. a segmented
  toggle or two radio options): **Create new folder** (default) and **Use existing
  folder**.
- **Create new folder**: the user enters only a project name; the folder is
  auto-created under the default projects dir (current empty-path behavior). No path
  picker is shown in this mode.
- **Use existing folder**: the user must pick a folder via the native picker (see
  #2). The **Create** button is disabled in this mode until a folder is selected.
- Switching modes clears any selected path so a stale value from the other mode is
  never submitted.
- Backend behavior is unchanged — `addProject` already supports both; this is a UI
  framing change that maps cleanly onto its existing empty-path vs. absolute-path
  branches.

### 2. Folder selection only (no typed path) + nicer control

- Remove the free-text **Folder path (optional)** `<input>`; a path can no longer be
  typed or pasted.
- In **Use existing folder** mode, the only way to set the path is the native
  directory picker via the existing `chooseDirectory` RPC.
- Replace the **Browse** button with a friendlier control:
  - When no folder is selected: a full-width "selector" button labeled e.g.
    **Choose folder…** with a `FolderOpen` (Lucide) icon.
  - When a folder is selected: show the chosen folder (basename emphasized, full
    path truncated/muted) with a small **Change** affordance to re-open the picker.
  - Styling consistent with the sidebar form (rounded, `bg-clide-surface` /
    `border-clide-border`, `text-[12px]`); disable while a dialog request is in
    flight to prevent double-opening.
- Cancelling the dialog leaves the current selection unchanged.

### 3. Remove "delete files from disk"; offer a reveal-in-Finder link instead

- In [SidebarProjectSettings.tsx](../src/mainview/components/SidebarProjectSettings.tsx),
  remove the **Also delete files from disk** checkbox, its `deleteFiles` state, the
  warning copy, and the "Delete permanently" button variant.
- The delete confirmation keeps a single action — **Remove** — which only
  unregisters the project from CLIDE (calls `deleteProject(path)` with no
  file deletion). Files on disk are always left intact.
- Add a link/button (e.g. **Reveal folder in Finder**, Lucide `FolderOpen` /
  `ExternalLink`) that opens the project folder in the OS file manager so the user
  can delete it manually if they choose.
- `deleteProject` / `removeProject` should no longer be called with
  `deleteFiles: true` from anywhere in the UI. (Optionally drop the `deleteFiles`
  parameter end-to-end — see "Out of scope / stretch".)

### 4. Show the current folder in project settings

- The settings panel displays the project's absolute folder `path` (already passed
  in as the `path` prop) under a labeled, read-only **Folder** field, styled like
  the existing **Name** section, with the path truncated and full value available on
  hover (`title`).
- The **Reveal folder in Finder** action from #3 sits with this field so the path is
  both visible and openable.

## Data / API changes

A new RPC to reveal a folder in the system file manager:

```ts
// shared/types.ts — within ClideRPC.bun requests
openFolder: {
  params: { path: string };
  response: { ok: boolean };
};
```

```ts
// bun/index.ts handler — Utils.openExternal already imported from electrobun/bun
openFolder: async ({ path }) => {
  const url = path.startsWith("file://") ? path : `file://${path}`;
  const ok = Utils.openExternal(url);
  return { ok };
},
```

```ts
// mainview/rpc.ts
async openFolder(path: string): Promise<boolean> {
  const r = request();
  if (!r) return false;
  try {
    const res = await r.openFolder({ path });
    return res.ok;
  } catch {
    return false;
  }
},
```

No change required to `addProject` / `removeProject` signatures for the core ticket
(the create-mode choice and folder-only selection are UI-side; deletion simply stops
passing `deleteFiles: true`).

## UI spec

- **Create form mode toggle**: a compact segmented control at the top of the
  expanded "New project" form. Default selection **Create new folder**.
- **Folder selector** (existing-folder mode): full-width button matching sidebar
  styling; `FolderOpen` icon; empty state label **Choose folder…**; selected state
  shows basename + muted truncated path + **Change**.
- **Settings — Folder field**: label `FOLDER` in the same
  `text-[11px] font-bold uppercase tracking-wide text-white/40` style as `NAME`;
  value in a read-only row, truncated, `title={path}`; **Reveal folder in Finder**
  inline.
- **Delete confirmation**: single **Remove** button (keep the existing red styling
  but without the "permanently" variant); copy reduced to "Remove "{name}" from
  CLIDE? Files on disk are kept." plus the reveal link.

## Files to modify

- `src/shared/types.ts` — add `openFolder` to the RPC schema.
- `src/bun/index.ts` — add `openFolder` handler (uses already-imported `Utils`).
- `src/mainview/rpc.ts` — add typed `openFolder` wrapper.
- `src/mainview/components/Sidebar.tsx` — mode toggle, remove free-text path input,
  replace **Browse** with the new folder selector control.
- `src/mainview/components/SidebarProjectSettings.tsx` — remove delete-files option,
  add read-only **Folder** field + reveal-in-Finder action.

## Edge cases

- **Existing-folder mode, no selection**: **Create** disabled; no submit possible.
- **Picker cancelled**: selection unchanged; no error.
- **Already-registered folder selected**: `addProject` dedupe returns the existing
  project — surface without throwing (current behavior).
- **`openExternal` fails / path missing**: wrapper returns `false`; show a subtle
  inline error or no-op rather than crashing.
- **Dialog/RPC unavailable in HMR**: selector is a no-op; create-new-folder mode
  still fully works.

## Out of scope / stretch

- Removing the `deleteFiles` parameter from `removeProject`/`deleteProject`/
  `api.removeProject` end-to-end. Recommended as a follow-up cleanup once no caller
  passes it, but not required for this ticket.
- Relocating a project's on-disk folder on rename (rename still only changes the
  display name).
- Extending the folder selector to the generic form `file` field
  ([FormField.tsx](../src/mainview/components/FormField.tsx)).
