# Ticket 82 — Deleting a View Focuses the Previous Tab, Not the Title Tab

## Goal

Deleting the active view currently snaps focus all the way back to the main
title tab (`deleteView` in
[AppContext.tsx](../src/mainview/context/AppContext.tsx) sets
`activeViewId` to `null`). Instead, focus should land on the **view tab
immediately to the left** of the deleted one — the browser convention, and
what ticket 43's tab model already implies.

## Acceptance criteria

- Deleting the **active** view activates its left neighbor in visible tab
  order (hidden views don't count). Only when the deleted view is the
  leftmost view does focus fall back to the title tab (`null`).
- Deleting a **non-active** view (via the Views page or the kebab modal,
  ticket 50) doesn't move focus at all — the active tab stays put.
- Closing a view tab with ⌘W (`closeActiveTab`) follows the same rule —
  both paths should share the one "who's next" computation.
- Tab order used for "previous" is the same order `ViewTabs` renders
  (respecting drag-reorder from `reorderView`).

## Files to modify

- `src/mainview/context/AppContext.tsx` (`deleteView`, `closeActiveTab`)

## Edge cases

- Deleting the only view: title tab, as today.
- Left neighbor is hidden: skip to the nearest visible tab to the left;
  none visible → title tab.
- Deletion triggered from the Views management page while the deleted view
  happens to be the active one behind the surface: the active-view change
  still applies, so returning to the thread lands on the neighbor.
