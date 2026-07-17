# Ticket 78 — First-Project Welcome: Full-Screen First-Run Experience

## Goal

When CLIDE has **zero registered projects**, the current welcome screen
(ticket 29) still reads like a returning user's landing page. Replace that
state with a **full-screen, dedicated first-run experience** — the very
first introduction to CLIDE. No clutter, no empty lists, no toolbar chrome:
just a warm "hey, let's get you set up" moment that gets their very first
project going.

## Acceptance criteria

### The screen

- Full-window takeover (same pattern as Settings/ticket 37 — no tab strip,
  no sidebar), shown whenever no project is registered.
- Content is minimal and welcoming: CLIDE branding, a one-liner about what
  CLIDE is ("your command line, as friendly forms" energy), and **one
  primary action**: create/open your first project. At most a secondary
  "open an existing folder" affordance — nothing else. Keep the staggered
  entrance animation feel from ticket 29.
- The create flow reuses the existing new-project machinery (folder picker,
  new-vs-existing choice from tickets 16/17/38) but presented inside this
  screen's flow, not as a modal stacked on a modal.

### Flow into AI setup (ticket 76)

- On a completely fresh install (no project **and** no AI service), this
  screen runs first; completing project creation **chains directly into the
  AI service wizard** (ticket 76) as the next step of one continuous
  hand-held flow — "Project ✓ → now let's connect your AI." The user should
  experience one guided onboarding, not two separate takeovers popping in
  sequence unannounced (a small step indicator like "1 of 2 · 2 of 2" is a
  nice touch).
- If an AI service already exists (e.g. user deleted all projects later),
  finishing project creation lands straight in the new project's thread.

### After first project

- Once ≥1 project exists, this screen never shows; the regular welcome/home
  page (with ticket 77's Projects list) takes over.

## Files to modify

- `src/mainview/components/FirstRunWelcome.tsx` (new — or a mode of
  `WelcomeScreen.tsx` if the zero-project branch stays cleaner in place)
- `src/mainview/App.tsx` (takeover gating + chaining order with ticket 76)
- `src/mainview/components/NewProjectModal.tsx` (extract the create-project
  form so it can render embedded here)
- `src/mainview/context/AppContext.tsx` (onboarding-chain state)

## Edge cases

- User cancels the folder picker mid-create: stay on the welcome screen,
  no error state, primary button ready again.
- User quits between step 1 (project) and step 2 (AI service): next launch
  should pick up at the AI wizard (ticket 76's own zero-services trigger
  covers this naturally).
- Deleting the last project while the app is open: return to this screen
  gracefully rather than stranding a dead project tab.
