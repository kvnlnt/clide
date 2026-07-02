# Ticket 25 — Project Title Tab & Project Menu

## Goal

The implicit "All" tab becomes the **project title tab**: it shows the active
project's name so the user always knows where they are, even with the sidebar
hidden. The project actions menu (Forms / Settings) moves off the sidebar rows
and onto this title tab.

Part of the 25→26→27→28 header/views arc. This ticket establishes the title
tab; ticket 26 turns Forms/Settings into tabs; ticket 28 adds view management.

## Acceptance criteria

### 1. Title tab

- In [ViewTabs.tsx](../src/mainview/components/ViewTabs.tsx), the first tab's
  label is the active project name (e.g. "Utilities"); "All" only when no
  project is active (`activeProject === null`).
- Behavior is otherwise unchanged: clicking it activates the implicit
  everything view (`activeViewId === null`).

### 2. Project menu on the title tab

- When the title tab is **active** and a project is selected, it shows the
  same ChevronDown affordance user views have. Clicking it (or re-clicking the
  active title tab) opens a PortalPopover menu with:
  - **Forms** — opens the forms surface (modal for now; tab in ticket 26).
  - **Settings** — opens the project's settings (rename/delete/folder).
- No project active → no chevron, plain "All" tab.

### 3. Sidebar cleanup

- [SidebarProject.tsx](../src/mainview/components/SidebarProject.tsx) loses
  the kebab menu entirely — rows are just name + badge + select on click.
- Project settings open-state moves from Sidebar-local state into
  [AppContext.tsx](../src/mainview/context/AppContext.tsx)
  (`openProjectSettings(path)` / `closeProjectSettings`), and
  `ProjectSettingsModal` renders from [App.tsx](../src/mainview/App.tsx) so
  both the title tab and any future caller can open it.

## Files to modify

- `src/mainview/components/ViewTabs.tsx` — title tab label + menu.
- `src/mainview/components/SidebarProject.tsx` / `Sidebar.tsx` — remove menu.
- `src/mainview/context/AppContext.tsx` — project settings open state.
- `src/mainview/App.tsx` — render ProjectSettingsModal at workspace level.

## Edge cases

- Long project names truncate (max-width like user view tabs).
- Active project deleted → title tab falls back to "All".
