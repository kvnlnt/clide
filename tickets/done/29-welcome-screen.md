# Ticket 29 — Welcome Screen

## Goal

Launching CLIDE with no active project currently drops the user straight into
a bare thread — it reads as an errant/broken state when it's really just
"nothing selected". Replace it with a proper welcome screen: branded,
inviting, and obvious about the three ways forward — create a project, open
an existing folder, or jump back into a recent project.

## When it shows

- `activeProject === null` (first launch, project deleted, or user deselects
  the active project in the sidebar).
- Note: ticket 28's UI-state restore means returning users usually land in
  their last project — the welcome screen is mostly a first-run / empty-state
  surface, so it should make a great first impression.

## Acceptance criteria

### 1. Layout & branding

- New `WelcomeScreen.tsx` rendered from [App.tsx](../src/mainview/App.tsx)
  in place of the Thread when no project is active (panel tabs and modals
  still take precedence when open).
- Centered composition: app title **CLIDE** (large, Inter, white), a short
  tagline (e.g. "everything is a form"), and a subtle mark/glyph consistent
  with the visual language (Lucide iconography, clide-bg/panel palette).
- The header tab strip shows no view tabs in this state (there is no
  project); title tab may read "CLIDE" or be hidden — no "All" thread.

### 2. Three actions

- **Create a new project** — opens the existing `NewProjectModal`
  (`openNewProject`).
- **Open an existing project** — native folder picker via the existing
  `chooseDirectory` RPC, then `addProject` with the folder's name; the new
  project becomes active immediately.
- **Recent projects** — list of registered projects (most recently active
  first; extend `uiState.json` with a `recentProjects: string[]` ordering,
  updated whenever `activeProject` changes). Click → `setActiveProject`.
  Cap at ~5 with the full list still available in the sidebar.

### 3. Animation

- Tasteful entrance animation on mount: staggered fade/slide-up of title →
  tagline → action buttons → recents (CSS keyframes or Tailwind animation
  utilities; ~500-800ms total, ease-out, no bounce).
- A slow ambient touch on the mark (e.g. gentle pulse or shimmer) that
  doesn't distract. Respect `prefers-reduced-motion` (disable both).

## Files to modify

- `src/mainview/components/WelcomeScreen.tsx` (new)
- `src/mainview/App.tsx` — render branch when `activeProject === null`
- `src/mainview/components/ViewTabs.tsx` — no-project header state
- `src/shared/types.ts`, `src/bun/uiState.ts` — `recentProjects` in UIState
- `src/mainview/context/AppContext.tsx` — track recents, expose for welcome
- `src/mainview/index.css` / `tailwind.config.js` — keyframes if needed

## Edge cases

- Zero registered projects → recents section hidden; the two primary actions
  carry the screen.
- Folder picked is already a registered project → just activate it (no dupe).
- Sidebar stays functional; selecting a project there dismisses the welcome.

## Out of scope

- Onboarding tours, sample-project generation (seeding already exists).
- Any change to the in-project thread empty state (ThreadEmpty).
