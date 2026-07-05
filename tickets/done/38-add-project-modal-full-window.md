# Ticket 38 — Add Project Modal Covers the Full Window

## Goal

The Add Project modal
([NewProjectModal.tsx](../src/mainview/components/NewProjectModal.tsx)) is
rendered inside the body pane, so its dimmed backdrop stops at the pane edges —
the header/tab strip and sidebar stay bright and clickable behind it. The
backdrop (and centered card) should cover the **entire app window**, matching
how modals conventionally take over the whole app.

## Acceptance criteria

- The modal's `absolute inset-0 bg-black/50` backdrop spans the full window
  content — header, tab strip, body, and sidebar are all dimmed underneath and
  not interactive while it's open.
- Implementation: move the `{newProjectOpen && <NewProjectModal …/>}` render
  out of the body-pane `div` in [App.tsx](../src/mainview/App.tsx) to the top
  level of `Workspace`, layered over the whole rounded window frame (respect
  the frame's rounded corners so the dim layer doesn't spill square edges).
- The card itself, its two modes (New / Open), validation, and close semantics
  (backdrop click, ×, Escape, Cancel) are unchanged.
- The modal works identically from the Welcome screen (no active project) and
  from inside a project — both entry points currently exist.

## Files to modify

- `src/mainview/App.tsx`
- `src/mainview/components/NewProjectModal.tsx` (only if backdrop classes need
  the rounded-corner adjustment)

## Edge cases

- Tab-strip clicks while the modal is open must hit the backdrop, not the
  tabs — verify the header's `electrobun-webkit-app-region-drag` region
  doesn't sit above the backdrop and swallow the dismiss click.
- Native directory-picker dialogs opened from the modal (`chooseDirectory`)
  return focus to the modal, not the workspace.

## Note

Same mechanic as ticket 37 (top-level overlay layer in `Workspace`). Whoever
lands first should leave an obvious slot for the other.
