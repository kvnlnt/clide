# Ticket 125 — Transparency: One Folder, One Reveal Button

## Goal

Everything the app has collected about the user — activity/run history,
machine info, app and project profiles — lives in one place on disk, and
a simple **Reveal** button opens that folder so the user can see it all.

## Acceptance criteria

### 1. One location

- Audit where user-derived data is written today
  ([paths.ts](../src/bun/paths.ts) / [config.ts](../src/bun/config.ts)
  app-data dir, `history.db` per project, app profile from
  [profile.ts](../src/bun/profile.ts), project profiles from
  [projectProfile.ts](../src/bun/projectProfile.ts), uiState, tool
  registry, credentials pointer) and document the inventory.
- Collected-about-the-user data is consolidated under (or clearly indexed
  from) one folder in the app data dir. Where a file can't move (e.g. a
  project's `history.db` lives with the project; API keys stay in the
  system keychain), the transparency folder contains a plain-text
  `README`/manifest saying what lives where and what's in it.

### 2. Reveal

- A "Transparency" row in Settings
  ([SettingsPanel.tsx](../src/mainview/components/SettingsPanel.tsx))
  with copy explaining what's collected, and a **Reveal** button that
  opens the folder in Finder — reuse the existing `api.openFolder` RPC
  (as used by [TasksPanel.tsx](../src/mainview/components/TasksPanel.tsx)).

### 3. Honesty rule

- The manifest is generated from code, not hand-maintained prose, so it
  can't silently drift from what's actually collected. Future features
  that add collection (e.g. ticket 106's audit log, ticket 124's
  diagnostics) must register with it.

## Files to modify

- `src/bun/paths.ts`, `config.ts`, new `src/bun/transparency.ts`
  (manifest + folder assembly), `src/bun/index.ts` (RPC)
- `src/mainview/components/SettingsPanel.tsx`

## Implementation

New `src/bun/transparency.ts` is the single source of truth per the
honesty rule: `collectionEntries()` is a code-level registry (label,
description, scope, on-disk location) covering everything the app
currently persists —

- **App-scoped** (all under `appDataDir()`): app profile
  ([profile.ts](../src/bun/profile.ts)), the registered-projects
  registry ([config.ts](../src/bun/config.ts)), AI service configs,
  `uiState.json`, the registered-tools directory (ticket 53).
- **System-scoped**: AI service API keys, named explicitly as living in
  the macOS keychain under service `"dev.clide.ai"` (confirmed in
  [credentials.ts](../src/bun/ai/credentials.ts)) — never in a file this
  app controls.
- **Project-scoped**: one entry per registered project (from
  `loadProjects()`), pointing at the project's own folder, since
  `history.db`, task/workflow definitions, the project's own AI profile,
  saved views, and scheduled runs all live there by ticket 17's
  self-contained-project design rather than being centralized.

Rather than physically moving files that already have a deliberate home
(a project's `history.db` shouldn't get yanked out of the project
folder; API keys can't leave the keychain), `writeTransparencyManifest()`
regenerates a plain-text `TRANSPARENCY.txt` in `appDataDir()` from that
registry on every reveal, listing every entry with its description and
exact on-disk location. Because it's generated from the same registry
every time — never hand-typed prose — it can't drift from what's
actually collected; the ticket's honesty rule is enforced by construction
(new persistence must be added to `collectionEntries()` to show up at
all, and there's nowhere else for stale copy to hide).

`prepareTransparencyReveal()` (RPC in `src/bun/index.ts`, client wrapper
in `src/mainview/rpc.ts`) regenerates the manifest and returns
`appDataDir()`; `SettingsPanel.tsx` calls it and then reuses the existing
`api.openFolder` RPC — the same one `TasksPanel.tsx` already uses — to
open the folder in Finder. A new "Transparency" row sits between
Diagnostics and AI Services in Settings, with copy summarizing what's
collected and a "Reveal" button; a `toast` error fires if either RPC
call fails.

Verified via `bunx tsc --noEmit` (clean) and the Vite preview: app boots
and renders with zero console errors. Settings (and therefore this row)
needs an active project to reach in the UI, so the Reveal button itself
wasn't eyes-on click-tested — same limitation as tickets 118-124.
