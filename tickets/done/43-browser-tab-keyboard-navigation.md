# Ticket 43 — Browser-Style Tab Keyboard Navigation

## Goal

The tab strip ([ViewTabs.tsx](../src/mainview/components/ViewTabs.tsx)) is
mouse-only. Give it the keyboard behavior every browser has, cross-platform:

- **Ctrl+Tab** — next tab (wraps)
- **Ctrl+Shift+Tab** — previous tab (wraps)
- **⌘W** (mac) / **Ctrl+W** (win/linux) — close the active tab

## Acceptance criteria

### 1. Cycle order

- The cycle covers the title tab plus all **visible** views, in tab-strip
  order: title → view 1 → view 2 → … → back to title. Hidden views are
  skipped.
- Ctrl+Tab / Ctrl+Shift+Tab work from anywhere in the workspace (thread,
  Forms page, Views page, project settings) — landing on a tab shows that
  tab's normal body (`setActiveView` semantics, which already reset the
  surface to the thread).
- Note: **Ctrl**+Tab on all platforms (this matches browsers on macOS too —
  it is *not* ⌘+Tab, which is the OS app switcher).

### 2. Close command

- ⌘W / Ctrl+W on an active **view** tab "closes" it using the existing
  hide semantics (`hidden: true`, fall back to the title tab) — views are
  persistent, so close = hide, recoverable from the Views page.
- On the title tab, the close command does nothing (the title tab is not
  closeable) — and critically, must not bubble into anything destructive.
- Platform detection via `navigator.platform` / user agent: bind ⌘W on mac,
  Ctrl+W elsewhere. `preventDefault()` before the webview or Electrobun can
  interpret the chord.

### 3. Overlays don't cycle

- While the Settings overlay, Add Project modal, or New Form page is open,
  all three chords are inert.

## Files to modify

- `src/mainview/App.tsx` or a new `src/mainview/hooks/useTabKeyboardNav.ts`
  (single window-level keydown handler alongside the existing ⌘P one)
- `src/mainview/context/AppContext.tsx` (helper like `cycleTab(delta)` /
  `closeActiveTab()` if cleaner than doing it in the hook)

## Edge cases

- **Verify Electrobun/WKWebView actually delivers Ctrl+Tab and ⌘W to the
  page.** If the native window swallows ⌘W (window close) before the DOM
  sees it, the fix belongs in the Bun-side window/menu config
  ([src/bun/index.ts](../src/bun/index.ts)) — call that out in the PR if
  needed rather than silently shipping a dead shortcut.
- Zero visible views: Ctrl+Tab is a no-op (only the title tab exists).
- Rapid repeated Ctrl+Tab keydowns (key held) should cycle smoothly, not
  stack state updates out of order.
