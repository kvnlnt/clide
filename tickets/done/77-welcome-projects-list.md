# Ticket 77 — Home Page: "Recent Projects" Becomes "Projects" (All of Them)

## Goal

The home/welcome page ([WelcomeScreen.tsx](../src/mainview/components/WelcomeScreen.tsx))
titles its list **"Recent projects"**, implying a truncated MRU list. Change
it to just **"Projects"** and present **every project CLIDE knows about**.
The home page should be the reliable index of everything, not a partial
memory of what was touched lately.

## Acceptance criteria

- Section heading reads **"Projects"**.
- The list contains all known projects (the union the context already
  computes — `projects` merged with `recentProjects`, recency can still
  drive the *ordering* so the most recently opened float to the top).
- **Long lists stay usable**: when the list exceeds a modest threshold
  (~8–10 entries), show a search/filter input above it — instant
  case-insensitive substring filtering on project name (and path, if shown).
  Below the threshold the input can be hidden or subdued; don't clutter the
  minimal welcome layout for a user with two projects.
- The list itself scrolls (`clide-scroll` styling) within the page rather
  than growing the whole welcome layout off-screen.
- Keyboard-friendly: typing filters, ↑/↓ move a highlight, Enter opens the
  highlighted project.

## Files to modify

- `src/mainview/components/WelcomeScreen.tsx`
- `src/mainview/context/AppContext.tsx` (only if the full project list
  isn't already exposed — grounding suggests it is)

## Edge cases

- A `recentProjects` entry whose project no longer exists on disk is already
  filtered out today — keep that behavior.
- Zero projects: this section disappears entirely; ticket 78's first-run
  welcome owns that state.
- Very long project names/paths: truncate with ellipsis + title tooltip.
