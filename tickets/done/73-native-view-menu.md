# Ticket 73 — Native View Menu Listing the Surface Shortcuts

*(Documented alongside implementation.)*

## Goal

The surface shortcuts (ticket 70) were invisible — nothing in the app told
users ⌘P exists. Add a native application **View** menu listing each jump
with its shortcut, macOS-style, so the menu bar doubles as the shortcut
reference.

## What was done

- [src/bun/index.ts](../../src/bun/index.ts): `ApplicationMenu` gains a
  **View** menu — Forms ⌘P, Calendar ⌘⇧C, Views ⌘⇧V, Project Settings ⌘,,
  and Run a Form… ⌘K — using Electrobun `action` + `accelerator` items.
  Clicks are forwarded to the renderer over a new `onMenuAction` webview
  message (`view:*` action ids), since the renderer owns surface state.
- [App.tsx](../../src/mainview/App.tsx): a single `dispatchViewAction`
  handles both the native menu actions and the in-page keydown shortcuts,
  with a 400ms same-action dedupe guard — some platforms deliver *both* the
  native accelerator and the webview key event, which would double-toggle a
  surface straight back to the thread.
- Menu actions respect the same gating as the shortcuts: inert while a
  blocking overlay is open or no project is active.
