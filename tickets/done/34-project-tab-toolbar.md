# Ticket 34 — Project Tab Toolbar

## Goal

The "special tabs" pattern isn't working. Today the project title tab carries a
`ChevronDown` dropdown menu (Forms / Settings / Hidden views), and Forms,
Settings, and Project Settings open as closeable panel-tab chips in the project
cluster (tickets 26 & 32). The chips don't look or behave like real tabs, and
the dropdown hides the project's tools behind an extra click.

Replace both with a **toolbar**: when the project title tab is active, a
toolbar strip renders at the top of the pane body, visually fused with the tab
so tab + toolbar read as one continuous surface. The toolbar hosts everything
the dropdown held; the panel-tab chips go away entirely.

## Acceptance criteria

### 1. Dropdown removed

- The `ChevronDown` button and its `PortalPopover` menu (Forms / Settings /
  Hidden views) are deleted from
  [ViewTabs.tsx](../src/mainview/components/ViewTabs.tsx).
- Clicking the project title tab activates it (as today); no menu affordance
  remains on the tab itself.

### 2. Toolbar below the active title tab

- When the title tab is active (`activeViewId === null`, no panel surface), a
  toolbar renders as the first row of the pane body, above the thread.
- Visual: it must look like part of the tab, not a separate bar — same
  background as the active tab / pane (`bg-clide-bg`), continuing the tab's
  border line, with a subtle bottom border separating it from the thread. The
  active tab already merges into the pane (`-mb-px border … bg-clide-bg`); the
  toolbar extends that surface.
- Contents:
  - **Forms** button (FileText icon + label) — shows the Forms surface.
  - **Settings** button (Settings icon + label) — shows the Project Settings
    surface.
  - **Hidden views** control — only rendered when hidden views exist; a small
    anchored menu (or chips) listing them; clicking one unhides it and
    activates its tab (same behavior as the old dropdown items).

### 3. Panel-tab chips retired

- The `openPanels` chip row in the project cluster is removed from
  `ViewTabs.tsx`, along with `PANEL_META` and the per-chip close buttons.
- Forms and Project Settings render as the pane body **below the toolbar**
  while the title tab stays active. The corresponding toolbar button shows a
  pressed/active state; clicking it again (or an explicit ×/back in the
  surface) returns to the thread.
- `AppContext` state simplifies: the `openPanels` array + `activePanel` /
  `openPanel` / `closePanel` / `focusPanel` machinery collapses into a single
  "active project surface" value (e.g. `projectSurface: "thread" | "forms" |
  "project-settings"`).
- App-level **Settings** (gear in
  [WindowControls.tsx](../src/mainview/components/WindowControls.tsx)) no
  longer creates a tab chip either — it opens the existing full-page
  [SettingsPanel.tsx](../src/mainview/components/SettingsPanel.tsx) (ticket 33)
  as an overlay surface; its top-right × returns to whatever was active.

### 4. Entry points keep working

- ⌘P activates the title tab (if needed) and shows the Forms surface.
- The "browse forms" affordance in
  [ThreadEmpty.tsx](../src/mainview/components/ThreadEmpty.tsx) routes to the
  same Forms surface.
- Switching to a view tab hides the project toolbar (view tabs get their own
  toolbar in ticket 35).

## Files to modify

- `src/mainview/components/ViewTabs.tsx`
- `src/mainview/components/ProjectToolbar.tsx` (new)
- `src/mainview/context/AppContext.tsx`
- `src/mainview/App.tsx`
- `src/mainview/components/WindowControls.tsx`
- `src/mainview/components/ThreadEmpty.tsx`

## Edge cases

- No active project (welcome screen): no toolbar, nothing to render.
- ⌘P while a view tab or Forms surface is already active: idempotent — ends on
  the title tab with Forms showing.
- Deleting/switching projects while a Forms/Settings surface is open resets the
  surface to the thread.
- Home button click (`setActiveProject(null)`) must also clear any open
  surface so returning to the project lands on the thread.

## Build the toolbar as a reusable primitive

Ticket 35 mounts a second toolbar of the same visual family under active view
tabs. Extract the shared shell (positioning, tab-fused styling, control
sizing) so both consume it.
