# Ticket 26 — Forms & Settings as Tabs

## Goal

Forms and Settings stop being modal overlays and become **special tabs** in
the header tab strip. Special tabs have no dropdown menu — just a close (×)
button. Depends on ticket 25 (title tab + project menu).

## Concept

A new `panelTab` concept lives alongside views in the tab strip:

```ts
type PanelTab =
  | { kind: "forms" }              // project-scoped forms CRUD
  | { kind: "settings" }           // app/AI settings
  | { kind: "project-settings" };  // active project's settings
```

- At most one instance of each kind is open at a time; opening again focuses
  the existing tab.
- When a panel tab is active, the main content area renders the panel pane
  instead of the Thread. Views/title tab remain clickable to switch back
  (panel tabs stay open but inactive).
- Closing the active panel tab returns to the previously active view.

## Acceptance criteria

1. **Tab strip** ([ViewTabs.tsx](../src/mainview/components/ViewTabs.tsx)):
   panel tabs render after the "+" button (right-aligned grouping is fine),
   with an icon + label ("Forms", "Settings", "<project> Settings") and an ×
   button. No chevron/dropdown.
2. **Forms pane**: [FormsPanel.tsx](../src/mainview/components/FormsPanel.tsx)
   content (search, list, edit, delete, create) renders as a full pane in the
   content column — no backdrop, no floating card, no Escape-to-close-modal
   (Escape clears search instead). Selecting a form still adds a draft card
   and switches back to the thread (closes/deactivates the tab).
3. **Settings pane**: [SettingsPanel.tsx](../src/mainview/components/SettingsPanel.tsx)
   (AI providers/keys) renders as a full pane; header gear opens this tab.
4. **Project settings pane**: `ProjectSettingsModal` content becomes a pane
   opened from the title tab menu (ticket 25's menu items now open tabs).
5. **⌘P** opens/focuses the Forms tab with the search input focused.
6. `NewFormModal` and `NewProjectModal` remain modals (transactional dialogs).
7. AppContext replaces `formsPanelOpen`/`settingsOpen` booleans with
   `openPanels: PanelTab kinds[]` + `activePanel` state; old open/close
   helpers keep working or are renamed at all call sites.

## Files to modify

- `src/mainview/context/AppContext.tsx` — panel tab state.
- `src/mainview/components/ViewTabs.tsx` — render panel tabs with ×.
- `src/mainview/components/FormsPanel.tsx`, `SettingsPanel.tsx`,
  `ProjectSettingsModal.tsx` — de-modal into panes (rename if clearer).
- `src/mainview/App.tsx` — content area switches Thread vs active pane.

## Edge cases

- Switching projects while a project-settings tab is open → tab retargets to
  the new active project (or closes if none).
- Sidebar hidden: everything still reachable via title tab + gear.
