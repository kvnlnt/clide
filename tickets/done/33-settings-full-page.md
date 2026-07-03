# Ticket 33 — Settings as a Full-Page Screen

## Goal

The global Settings tab still renders as a floating 480px bordered card
centered in the pane
([SettingsPanel.tsx](../../src/mainview/components/SettingsPanel.tsx)) — the
same modal-look problem ticket 31 fixed for the Forms surfaces. Make Settings
a **full-page screen**: it fills the entire content pane, with a **single ×
icon pinned to the top-right** of the page as the one exit affordance.

## Acceptance criteria

### 1. Full-page layout

- The settings content fills the pane edge-to-edge on the pane background
  (`bg-clide-bg`) — no floating card, card border, or card header bar.
- A single × button sits at the **top-right corner of the page**, closing the
  settings tab (`closePanel("settings")`). No other close buttons on the
  page.
- Content may keep a readable centered column (e.g. `max-w-[560px]`) inside
  the full-bleed page, following the pattern ticket 31 set for the Forms
  panel; the page title ("Settings") renders as a page heading, not a card
  header.
- Escape closes the page, same as the ×.

### 2. Scope

- This ticket covers the global Settings panel only. Project Settings
  ([ProjectSettingsModal.tsx](../../src/mainview/components/ProjectSettingsModal.tsx))
  is a candidate for the same treatment but ships separately — note any
  shared layout pieces worth extracting (a `PanelPage` wrapper with title +
  top-right × would serve Settings, Project Settings, and Forms).
- The Settings *tab* in the strip is unchanged (icon, label, its own × —
  that's tab chrome, not page chrome).

### 3. Behavior unchanged

- Provider API-key fields, saved-key indicators, Ollama base URL, and the
  Save flow (including the transient "Saved" confirmation) work exactly as
  today.

## Files to modify

- `src/mainview/components/SettingsPanel.tsx`
- Possibly a new shared page wrapper component if extraction proves worth it

## Edge cases

- Long content on short windows: the page scrolls (`clide-scroll`) while the
  × stays reachable — pin it in a page header row that doesn't scroll away,
  or keep it fixed within the pane.
- Settings opened with no active project (gear icon only shows with a
  project today) — no new states introduced.
