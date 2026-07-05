# Ticket 37 — Settings as Full-Window Overlay

## Goal

App Settings ([SettingsPanel.tsx](../src/mainview/components/SettingsPanel.tsx))
currently renders inside the body pane — below the header/tab strip and beside
the sidebar. It should cover the **entire app window**, header included:
opening Settings replaces everything inside the window chrome until closed.

## Acceptance criteria

- Opening Settings (gear in
  [WindowControls.tsx](../src/mainview/components/WindowControls.tsx)) shows
  the settings page across the full window content area — over the tab strip,
  window-controls row, thread, and sidebar. Nothing of the workspace remains
  visible behind or around it.
- Implementation: render the overlay at the top level of `Workspace` in
  [App.tsx](../src/mainview/App.tsx) — as a sibling layered over the whole
  rounded window frame (`absolute inset-0` within the outer container, opaque
  `bg-clide-bg`, matching the window's rounded corners) — not inside the body
  pane's flex slot.
- The traffic-light window buttons must remain usable: either keep a minimal
  drag/controls strip at the top of the overlay or overlay everything *below*
  the native-controls row — pick whichever reads cleaner, but the window must
  still be closable/movable while Settings is open.
- Existing behavior is otherwise unchanged: top-right × and Escape close it,
  returning to exactly the state the user left (active tab, surface, sidebar).
- `appSettingsOpen` state in
  [AppContext.tsx](../src/mainview/context/AppContext.tsx) is unchanged — this
  is a render-placement change, not a state change.

## Files to modify

- `src/mainview/App.tsx`
- `src/mainview/components/SettingsPanel.tsx` (layout/chrome only)

## Edge cases

- Settings opened while a view tab is active: closing restores that view tab
  untouched (state was never cleared).
- ⌘P and other workspace shortcuts should not fire underneath while the
  overlay is open.
- Welcome screen (no project): the gear isn't currently rendered there — if
  that changes later, the overlay must still work without an active project.
