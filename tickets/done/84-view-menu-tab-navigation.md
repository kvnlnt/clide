# Ticket 84 — Tab Navigation Shortcuts in the Application View Menu

## Goal

The native **View** menu (ticket 73, [index.ts](../src/bun/index.ts)) lists
the surface jumps (⌘P, ⌘⇧C, ⌘⇧V, ⌘,, ⌘K) but says nothing about the view
*tab* navigation shortcuts — Ctrl+Tab / Ctrl+Shift+Tab cycling and ⌘W from
ticket 43 (plus ⌘T from ticket 83) are invisible. Add them to the View menu
so the menu bar remains the complete shortcut reference.

## Acceptance criteria

- The View menu gains a tab-navigation group, separated from the surface
  jumps:
  - **New Tab** — ⌘T / Ctrl+T (ticket 83)
  - **Close Tab** — ⌘W / Ctrl+W
  - **Next Tab** — Ctrl+Tab
  - **Previous Tab** — Ctrl+Shift+Tab
- Menu items actually work, not just display: clicks forward over the
  existing `onMenuAction` channel as new `view:*` action ids, dispatched
  through `dispatchViewAction` in [App.tsx](../src/mainview/App.tsx) to the
  same `createView` / `closeActiveTab` / `cycleTab` paths the keyboard
  uses — including the 400ms same-action dedupe guard from ticket 73 (the
  accelerator + webview key double-delivery applies to these too).
- Same gating as the rest of the menu: inert while a blocking overlay is
  open or no project is active.
- Accelerator labels render platform-correctly via the existing
  CommandOrControl convention (Ctrl+Tab is Ctrl on both platforms, as the
  browser convention dictates).

## Files to modify

- `src/bun/index.ts` (menu items + action ids)
- `src/mainview/App.tsx` (`dispatchViewAction` cases)

## Edge cases

- Electrobun accelerator support for `Ctrl+Tab` in a native menu may be
  platform-quirky; if the accelerator can't be registered natively, the
  menu item should still show the shortcut string as its label hint and the
  in-page handler remains the actual trigger.
- Close Tab with no active view (title tab focused): item should no-op
  exactly like ⌘W does today.
