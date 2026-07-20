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
