# Ticket 50 — View Actions Kebab Menu & Modal

## Goal

The view toolbar ([ViewToolbar.tsx](../src/mainview/components/ViewToolbar.tsx))
currently exposes three view-management actions as separate inline controls:
an inline pencil/input for rename on the left, and Hide (eye-off) / Delete
(trash) buttons on the right. Consolidate all three into a **single view
settings modal** launched from a **kebab menu icon (⋮)** that sits where the
delete button sits today. The toolbar itself keeps only filter controls and
the Run button.

## Acceptance criteria

### 1. Kebab trigger

- The eye-off and trash buttons at the right end of the toolbar are replaced
  by one kebab icon button (Lucide `EllipsisVertical`), same compact styling
  as the buttons it replaces (white/40, hover white + white/5 bg).
- The inline rename affordance (pencil button + swap-to-input) is removed
  from the toolbar entirely.

### 2. View settings modal

- Clicking the kebab opens a modal containing the three functions:
  - **Rename**: a text input pre-filled with the view name. Commit applies
    via the existing `updateView` path; empty/whitespace names are rejected
    (revert to current name, same as today's `commitName`).
  - **Hide**: hides the tab (`updateView({ ...view, hidden: true })`) and, if
    it is the active view, clears the active view (`setActiveView(null)`) —
    same behavior as the current hide button. Closing text should still point
    at the project toolbar as the place to unhide.
  - **Delete**: deletes the view (`deleteView(view.id)`). Style it as the
    destructive action (red, visually separated from rename/hide).
- Hide and Delete close the modal as part of their action (the view/tab they
  belong to goes away).
- Modal follows the app's established modal conventions: full-window backdrop
  dim (ticket 38), `clide-panel` surface, Escape and backdrop-click close,
  a top-right × (ticket 33 language).

### 3. Toolbar layout after removal

- With rename/hide/delete gone, the toolbar row is: Run, divider, the three
  filter dropdowns, spacer, kebab. No leftover dividers from the removed
  rename control.

## Files to modify

- `src/mainview/components/ViewToolbar.tsx`
- `src/mainview/components/ViewSettingsModal.tsx` (new — or reuse an existing
  modal primitive if one fits)

## Edge cases

- Renaming to the same name is a no-op (no `updateView` churn).
- Escape while the rename input has uncommitted text closes the modal without
  applying the rename.
- Only one surface open at a time: opening the kebab modal closes any open
  filter dropdown, and vice versa.
