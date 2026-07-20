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
