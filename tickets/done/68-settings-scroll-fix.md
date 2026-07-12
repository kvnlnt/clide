# Ticket 68 — Settings Page Doesn't Scroll (min-h-0 Flex Chain)

## Bug

Expand a few items on the Settings page (AI service editors, tool entries
with their specs/raw-help `<details>`, ticket 57's Tools section) and the
content runs **off the bottom of the window with no way to scroll to it**.

## Root cause

The scroll container in
[SettingsPanel.tsx](../src/mainview/components/SettingsPanel.tsx)
(`clide-scroll flex-1 overflow-y-auto`) sits in a flex column chain:

```
App.tsx overlay   absolute inset-0 flex flex-col   ← bounded (window height)
└─ SettingsPanel  flex flex-1 flex-col             ← flex child, min-height: auto
   └─ body        clide-scroll flex-1 overflow-y-auto
```

Flex items default to `min-height: auto`, which forbids shrinking below
content height — so when expanded entries make the content taller than the
window, the `SettingsPanel` root (and the body with it) simply **grows past
the overlay's bounds** instead of the body hitting its height limit and
engaging `overflow-y-auto`. The scrollbar never appears because, as far as
the scroll container knows, it's tall enough.

## Fix / acceptance criteria

- Add `min-h-0` at each level of the chain that needs it (`SettingsPanel`'s
  root, and the `flex-1` scroll body if required) so the body is actually
  height-constrained and scrolls. Alternatively `overflow-hidden` on the
  overlay's column — pick the minimal change that works, but fix the chain,
  don't wrap things in fixed heights.
- With many services and tools expanded (specs, raw-help `<details>` open,
  paste-help editor visible), the Settings body scrolls smoothly to the last
  item; the page header row ("Settings" + ×) stays pinned and reachable the
  whole time.
- The ToolDropZone wrapper inside the Tools section (relative-positioned)
  must not clip or block the scroll — its drag-over overlay still covers the
  section correctly *while scrolled*.
- Sweep the other full-window overlay for the same latent bug: the wizard
  (ticket 67 moves it into an identical `absolute inset-0 flex flex-col`
  container) — its `clide-scroll flex-1` body needs the same guarantee.
  Verify rather than assume.

## Files to modify

- `src/mainview/components/SettingsPanel.tsx`
- `src/mainview/App.tsx` (overlay container, if the fix lands there)
- `src/mainview/components/NewFormPage.tsx` (same-chain verification)

## Edge cases

- Small window heights: even the *collapsed* settings content may exceed the
  viewport — scrolling must work from the start, not only after expanding.
- The Escape-to-close handler and the pinned × keep working while scrolled
  to the bottom.
