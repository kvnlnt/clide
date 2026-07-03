# Ticket 30 — Unified View Editor

## Goal

Today an active view tab has two separate surfaces: a dropdown menu (chevron →
Edit filters / Hide / Delete) and a small anchored popover form for editing
name + filters ([ViewFilterEditor.tsx](../src/mainview/components/ViewFilterEditor.tsx)).
Merge them into **one view editor** that contains both the filter form and the
view actions, and give it room to breathe:

1. Editing an **existing** view opens the combined editor in a centered
   **modal** (not an anchored popover).
2. Creating a **new** view (the "+" button) renders the same combined editor
   as the new tab's **page body content** — the popover is far too small for
   this flow.
3. The active tab's affordance changes from `ChevronDown` (menu connotation)
   to an icon that says "adjust this view" — e.g. `SlidersHorizontal`.
4. The **"Pinned only"** filter is removed — tab pinning is gone and the
   option no longer makes sense.

## Acceptance criteria

### 1. Combined editor component

- One component (rename `ViewFilterEditor` → `ViewEditor`) containing:
  - Name, Forms picker (chips + search), Status checkboxes, Text query —
    unchanged behavior.
  - The former menu actions: **Hide tab** and **Delete view** (Edit filters
    disappears as a separate action — the whole editor *is* edit).
  - Save / Cancel.
- No "Pinned only" checkbox.

### 2. Existing view → modal

- On the active view tab, replace the `ChevronDown` button with
  `SlidersHorizontal` (same click behavior: only visible/active on the active
  tab).
- Clicking it opens the combined editor centered in the content area with a
  dimmed backdrop — not a `PortalPopover` anchored to the tab.
- The per-tab dropdown menu (`PortalPopover` with Edit/Hide/Delete) is deleted
  from [ViewTabs.tsx](../src/mainview/components/ViewTabs.tsx).
- Escape / backdrop click = Cancel. Hide and Delete close the modal and apply
  the existing fallback (active view hidden/deleted → title tab).

### 3. New view → tab body content

- "+" still creates the view and activates its tab, but instead of a popover,
  the tab's body (the pane where [Thread.tsx](../src/mainview/components/Thread.tsx)
  renders) shows the combined editor as full page content.
- Save → the tab shows its (possibly empty-filter) thread.
- Cancel → the just-created view is deleted and the previous tab (title tab)
  becomes active — same semantics as today's `dismissEditor`.
- Likely needs a small piece of app state (e.g. `editingNewViewId` in
  [AppContext.tsx](../src/mainview/context/AppContext.tsx)) so the workspace
  knows to render the editor instead of the thread.

### 4. Remove "Pinned only"

- Drop `pinnedOnly` from `ThreadViewFilters` in
  [types.ts](../src/shared/types.ts), from the editor UI, and from the filter
  logic in [useThread.ts](../src/mainview/hooks/useThread.ts) (`matchesFilters`).
- The view-scoped **Pinned bucket** (ticket 27 — pinned *runs* float to the
  top inside views) is untouched; only the filter option goes away.

## Files to modify

- `src/mainview/components/ViewTabs.tsx`
- `src/mainview/components/ViewFilterEditor.tsx` → `ViewEditor.tsx`
- `src/mainview/context/AppContext.tsx`
- `src/mainview/App.tsx` (render editor as body content for new views)
- `src/shared/types.ts`, `src/mainview/hooks/useThread.ts`

## Edge cases

- `.views.json` files written with `pinnedOnly` still load — unknown filter
  fields are ignored.
- Switching tabs (or projects) while a new view's body editor is open should
  cancel it (delete the draft view) rather than leaving an orphan.
- Deleting the view from the modal while it's active falls back to the title
  tab cleanly.
