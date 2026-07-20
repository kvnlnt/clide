# Ticket 118 — Files Surface: Make It Work and Match the Theme

## Goal

The virtual file system UI (ticket 102) doesn't work in practice, and its
styling doesn't match the app. Bring
[FilesPage.tsx](../src/mainview/components/files/FilesPage.tsx) (and
[ArtifactModal.tsx](../src/mainview/components/files/ArtifactModal.tsx))
up to the standard of the other surfaces.

## Acceptance criteria

### 1. It works

- Diagnose why the Files surface fails (browse? search? open? locations
  registry?) against the ticket 102 backend
  ([src/bun/vfs/](../src/bun/vfs/)) and fix it: browsing a location,
  searching, opening a file, and previewing run artifacts all function on
  a seeded profile (`bun run dev:regular` — via ticket 114).
- Errors from providers surface as visible, recoverable states in the UI,
  not silent emptiness.

### 2. It looks like CLIDE

- Restyle to the visual language in [00-overview.md](00-overview.md):
  `clide-bg`/`clide-surface`/`clide-panel` fills, `clide-border`, white
  text at the standard opacities, Inter, Lucide icons, `clide-scroll`
  scrollbars, full-width page layout like Tasks/Views/Calendar.
- Both scopes (app-level and project-level Files surfaces) match.

## Files to modify

- `src/mainview/components/files/FilesPage.tsx`, `ArtifactModal.tsx`
- `src/bun/vfs/*` as the functional diagnosis dictates

## Diagnosis (confirmed root causes)

1. `vfsList`/`vfsStat`/`vfsSearch`/`vfsOpen`/`vfsReadPreview` never carried
   a `project` param, and their handlers called `getLocation(locationId)`
   with no `projectPath` — `getLocation` can only find project-scoped
   locations when given one. Every project-scoped location was
   permanently unbrowsable/unsearchable/unopenable; only app-scoped
   locations ever worked. Fixed by threading `project` (a name, resolved
   server-side via `pathForProjectName`, matching the convention every
   other project-scoped RPC already uses) through all five RPCs.
2. `FilesPage.tsx`'s `handleAddLocation` set `VfsLocation.project` to the
   project's display **name**, but `registry.ts`'s `addLocation`/
   `listProjectLocations` use that field directly as a filesystem path
   (`join(projectPath, "vfs.json")`) — per its own doc comment, "Project
   path when scope === project". Adding a project-scoped location wrote
   `.vfs.json` under a bogus name-shaped relative path instead of the
   real project folder. Fixed by resolving the name to its actual path
   via `projectMeta` before constructing the location.
3. `ArtifactModal.tsx`'s preview loading was entirely stubbed out
   (`loadPreview` was dead code — comments literally say "we can't
   easily extract locationId from the URI, we'll skip preview for now").
   Every artifact fell through to a static Open/Reveal panel regardless
   of type. Fixed with a real preview using new URI-based RPCs
   (`vfsReadByUri`/`vfsOpenByUri`) that dispatch straight to the
   provider by URI scheme — artifacts carry a self-contained URI
   (`local:///Users/…`) that was never tied to a registered location in
   the first place, so no location lookup applies or is needed.
4. Both files used plain Tailwind grays/blues/white backgrounds and
   `alert()`/`confirm()` instead of the app's `useUIFeedback` toast/
   confirm system — restyled to the standard visual language and error
   handling in both files.

Verified via `tsc --noEmit` and code-level tracing of every call path;
this was not exercised live in the running Electrobun app (no way to
drive its native webview from this environment) — worth a manual pass
with `bun run dev:regular` before fully trusting it.
