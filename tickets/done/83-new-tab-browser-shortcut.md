# Ticket 83 — Browser-Style New-Tab Shortcut (⌘T / Ctrl+T)

## Goal

Tab navigation already mirrors the browser (ticket 43: Ctrl+Tab cycling,
⌘W close), but creating a new view tab still requires clicking the "+"
button in [ViewTabs.tsx](../src/mainview/components/ViewTabs.tsx). Complete
the browser muscle-memory set: **⌘T (macOS) / Ctrl+T (Windows/Linux)**
creates a new tab.

## Acceptance criteria

- ⌘T / Ctrl+T triggers exactly what the "+" button does today —
  `createView()`: a new view tab opens, becomes active, and lands in its
  new-view editing state (ticket 30's tab-body editor).
- Registered in the shared keyboard handler in
  [App.tsx](../src/mainview/App.tsx) alongside Ctrl+Tab/⌘W, honoring the
  same guards: inert while a blocking overlay/modal is open, while typing
  in an input, and when no project is active.
- Cross-platform via the same CommandOrControl convention the other tab
  shortcuts use.
- Discoverable: listed in the native View menu — coordinate with ticket 84,
  which adds the tab shortcuts to the application menu.

## Files to modify

- `src/mainview/App.tsx`
- `src/bun/index.ts` (menu item — may land via ticket 84)

## Edge cases

- Mid-edit on another new unsaved view: pressing ⌘T shouldn't spawn a pile
  of half-configured views — either focus the existing unsaved view or
  follow whatever `createView()` already does from the "+" button (behavior
  must simply match the button exactly).
- The native-menu accelerator + webview key event double-delivery needs the
  same dedupe guard ticket 73 added for the surface actions.
