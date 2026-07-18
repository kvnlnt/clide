# Ticket 102 — Virtual File System (Epic)

## Goal

Tasks run arbitrary CLI tools, and those tools touch files the app is
blind to. Introduce a **virtual file system (VFS)**: a first-class registry
of files and locations, **on par with the tool registry**. Just as a task
can wrap _any CLI_, the VFS can track _any file_ on _any system_ — local
disk today, remote providers (Dropbox, Google Drive, …) behind the same
interface. Users can browse, open, search, and configure where files live,
and — most importantly — **associate locations with tasks** so a run's
results surface the actual files it produced or modified: inline previews
where sensible, a modal viewer otherwise, always openable natively.

Motivating case: a task appends to a pre-existing PDF, or dynamically finds
and modifies a _set_ of PDFs — the run card should show those PDFs, not
just stdout.

This is an epic; expect a grooming split (provider model + local backend,
files surface, task association + run artifacts, remote connectors).

## Acceptance criteria

### 1. VFS model & provider interface

- `src/bun/vfs/`: a `VfsProvider` interface — `list`, `stat`, `read`
  (stream), `search`, `watch?`, `openNative`, plus capability flags
  (watchable, writable, previewUrl). A **VfsLocation** is a registered
  root: `{ id, name, provider, config, scope }` — scope is app-level or a
  specific project (mirrors the tool registry's shape,
  [tools/](../src/bun/tools/)).
- **Local provider** ships in this epic: wraps a directory (or single
  file), fs metadata, glob search, mtime/size stat, fs watching.
- **Remote providers (Dropbox, Google Drive)** are specced by the
  interface and stubbed with a "connect" placeholder; full OAuth + API
  implementations are explicit follow-up tickets. Nothing in the model may
  assume local paths (ids are provider-scoped URIs, e.g.
  `local:/Users/…`, `dropbox:/reports/q3.pdf`).
- Registry persisted like tools: app-scoped locations in `dev.clide`,
  project-scoped in the project folder. RPC: locations CRUD, `vfsList`,
  `vfsSearch`, `vfsStat`, `vfsOpen`, `vfsReadPreview`.

### 2. Files surface

- A **Files** section in Settings (app locations) and on the project
  toolbar or project settings (project locations) — follow the ticket-57
  precedent of tools living in Settings; decide placement during
  implementation and keep both scopes visually consistent.
- The surface: add/edit/remove locations (provider picker, local = native
  directory picker per ticket 14; remote = connect stub), then **browse**
  a location (name, size, modified), **search** across locations
  (debounced, provider-delegated), **open** any file natively
  (`api.openFolder`-style reveal + default-app open).

### 3. Task ↔ file association

- `TaskDefinition` gains `fileAssociations?: { locationId, pattern? }[]` —
  "this task works within these locations (optionally narrowed by glob,
  e.g. `**/*.pdf`)". Authored in the task wizard as a light step-4 addition
  (alongside output definitions, tickets 86/87) and editable later.
  Engine-blind: native-backed tasks (ticket 99) author associations in the
  same step even though they skip CLI mapping.
- Association powers **artifact detection** (§4) and inline affordances:
  the task card menu gets "Show files" jumping to the location browser
  pre-filtered.

### 4. Run artifacts — files a run touched

- Two detection channels, both feeding one `RunArtifact[]` list persisted
  per run (additive `history.db` table):
  1. **Declared**: output definitions with path-like results (the existing
     `lastPathLine` extraction and friends) resolve against the VFS.
  2. **Observed**: for each associated location, snapshot (path, mtime,
     size) before the run and diff after — created/modified/deleted files
     within the association's glob become artifacts. This is what catches
     "dynamically found and modified a series of PDFs" without the script
     declaring anything.
- Observed-diff is bounded: per-location file-count cap and a depth cap,
  skipped with a visible notice when a location is too large to snapshot
  cheaply.

### 5. Artifact display in run results

- Run cards ([SubmissionAccordionRow.tsx](../src/mainview/components/SubmissionAccordionRow.tsx)
  / [output/OutputBlock.tsx](../src/mainview/components/output/OutputBlock.tsx))
  gain an **Artifacts strip**: one chip/thumbnail per artifact with name,
  change kind (created/modified/deleted), and type icon.
- Per-type preview, reusing the existing output viewers where possible:
  images → inline thumbnail expanding in a modal
  ([ImageOutput.tsx](../src/mainview/components/output/ImageOutput.tsx)
  pattern); **PDF → embedded preview in a modal** (webview/iframe render);
  audio/video → existing players; text/JSON → existing viewers (capped);
  everything else → icon chip with "Open" (native app) and "Reveal".
  Modals follow ticket 74/75 conventions.
- Deleted artifacts render as a tombstone chip (no preview, no open).
- Remote artifacts show provider badge; preview fetches through the
  provider's `read`/`previewUrl` when connected.

## Files to modify

- New: `src/bun/vfs/` (provider interface, local provider, registry,
  snapshot/diff), `src/mainview/components/files/` (FilesPage,
  LocationBrowser, ArtifactStrip, ArtifactModal)
- `src/shared/types.ts` (VfsLocation, RunArtifact, TaskDefinition,
  RPC), `src/bun/index.ts`, `src/bun/db/migrations.ts` + `history.ts`,
  `src/bun/runner/execute.ts` (pre/post snapshot hook), wizard step 4,
  `SettingsPanel.tsx`, `ProjectToolbar.tsx` or `ProjectSettingsPage.tsx`,
  run card components listed above

## Edge cases

- A run modifying files _outside_ any associated location is invisible by
  design — document this in the association editor's helper copy ("CLIDE
  only watches where you point it").
- Two tasks running concurrently against the same location: snapshots are
  per-run; overlapping writes may double-attribute — acceptable, note it.
- Files > preview cap (say 25 MB) never load inline — chip + native open.
- Path security: `vfsOpen`/`vfsReadPreview` must resolve strictly inside a
  registered location (reject `..` traversal and symlink escapes) —
  the renderer must not be able to read arbitrary disk paths through VFS
  RPC.
- Watcher storms (a location inside `node_modules`-like churn): debounce
  and cap events; watching is per-location opt-in, off by default.
- Deleting a location leaves past runs' artifact records intact (they
  render as unavailable, with the recorded name/kind).

## Note

Vocabulary per ticket 96 ("task"). Independent of 100/101; pairs naturally
with ticket 99 (a browser-automation download step producing artifacts) —
if 99 lands first, its screenshots/downloads should adopt `RunArtifact`
(99 records artifact paths in its run trace precisely so this epic can
adopt them wholesale).
