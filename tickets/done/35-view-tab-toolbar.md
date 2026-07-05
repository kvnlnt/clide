# Ticket 35 — View Tab Toolbar

## Goal

Editing a view currently opens
[ViewEditor.tsx](../src/mainview/components/ViewEditor.tsx) as a centered
modal over the pane (ticket 30). Following ticket 34's pattern, kill the modal:
when a view tab is active, its settings render as **controls in a toolbar** at
the top of the pane body, visually fused with the active tab — the same
tab-continues-into-toolbar treatment as the project tab's toolbar.

## Acceptance criteria

### 1. Toolbar replaces the modal

- Activating a view tab renders a toolbar as the first row of the pane body,
  above the filtered thread. Same visual language as ticket 34's toolbar
  (shared shell component): active tab and toolbar read as one surface.
- The `SlidersHorizontal` button on the active tab and the `editView` /
  `editingViewId` modal plumbing
  ([ViewTabs.tsx](../src/mainview/components/ViewTabs.tsx),
  [AppContext.tsx](../src/mainview/context/AppContext.tsx),
  [App.tsx](../src/mainview/App.tsx)) are removed. `ViewEditor`'s `"modal"`
  variant is deleted.

### 2. Editor contents become toolbar controls

All of the modal's contents move into the toolbar as compact inline controls
(one row, wrapping to a second row when narrow):

- **Name** — inline editable text (click-to-edit or a borderless input);
  renaming updates the tab label.
- **Forms filter** — selected forms as removable chips plus an "add form"
  control opening the existing search/suggestion list in a small popover
  anchored to the toolbar.
- **Status filter** — the five statuses as toggleable chips (replacing the
  checkbox list).
- **Text query** — a compact input.
- **Hide** and **Delete** — right-aligned icon buttons with the same semantics
  as today (hide → title tab fallback; delete → title tab fallback).

### 3. Live apply — no Save/Cancel

- Toolbar controls apply to the view immediately (persisting to `.views.json`
  via the existing `updateView` path; debounce text inputs). The thread below
  re-filters live as controls change.
- Save / Cancel buttons disappear. Escape just blurs the focused control.

### 4. New-view flow

- "+" still creates a view and activates its tab, but the full-page editor
  (`newView` page variant rendered in
  [App.tsx](../src/mainview/App.tsx)) goes away. The new view is committed
  immediately with a default name, its tab activates, the toolbar appears with
  the name control focused, and the unfiltered thread shows beneath.
- Backing out = Delete from the toolbar. The `newView` / `commitNewView` /
  `discardNewView` draft machinery in `AppContext` can be removed.

## Files to modify

- `src/mainview/components/ViewEditor.tsx` → rework into `ViewToolbar.tsx`
- `src/mainview/components/ViewTabs.tsx`
- `src/mainview/context/AppContext.tsx`
- `src/mainview/App.tsx`
- Shared toolbar shell from ticket 34

## Edge cases

- Renaming to empty: keep the previous name on blur (same fallback the modal's
  Save used).
- Switching tabs or projects mid-edit: nothing to discard — edits already
  applied; debounced writes must flush.
- Long chip rows (many form filters) wrap without pushing the thread's scroll
  area into jank; the toolbar has a max height with its own overflow if
  needed.
- The forms-picker popover closes on outside click / Escape / tab switch.
- Title tab shows ticket 34's project toolbar instead — exactly one toolbar is
  ever visible.

## Dependency

Builds on ticket 34's shared toolbar shell — land 34 first.
