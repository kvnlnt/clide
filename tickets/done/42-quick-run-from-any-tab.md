# Ticket 42 — Quick-Run a Form from Any Tab

## Goal

Running a form currently requires leaving the current tab: title tab → Forms
page → click the form. From a view tab it's even longer. Add a fast, always-
available way to run a form without leaving whatever tab is active.

## Acceptance criteria

### 1. Run button in both toolbars

- A prominent **Run** button (e.g. `Play` icon + "Run") appears in both the
  project toolbar ([ProjectToolbar.tsx](../src/mainview/components/ProjectToolbar.tsx))
  and the view toolbar ([ViewToolbar.tsx](../src/mainview/components/ViewToolbar.tsx)),
  ideally as the first control so it reads as the primary action.
- Clicking it opens a compact searchable form picker (same autocomplete
  pattern as the view toolbar's forms filter: input + live suggestions,
  Enter picks the first match, ↑/↓ navigate).
- Picking a form calls the existing `addFormDraft` path — a draft card
  appears at the top of the **current tab's** thread, expanded and ready to
  fill/submit. The active tab does not change.

### 2. Keyboard shortcut

- **⌘K** (mac) / **Ctrl+K** (win/linux) opens the same picker from anywhere
  a project is active — view tab or title tab. (⌘P stays as-is: it opens the
  full Forms management page.)
- Escape closes the picker; focus returns to the page.

### 3. Draft behavior on view tabs

- `addFormDraft` currently calls `setProjectSurfaceState("thread")` — verify
  it does **not** clear `activeViewId`, so the draft shows in the active
  view's thread. Drafts render above the run groups regardless of the view's
  filters (they're unsubmitted, so filters don't apply to them).

## Files to modify

- `src/mainview/components/RunFormPicker.tsx` (new — the shared picker popover)
- `src/mainview/components/ProjectToolbar.tsx`
- `src/mainview/components/ViewToolbar.tsx`
- `src/mainview/App.tsx` (⌘K handler)
- `src/mainview/context/AppContext.tsx` (only if draft/tab interaction needs
  adjusting)

## Edge cases

- No forms in the project: the picker shows an empty state with a "Create new
  form…" entry (same as the Forms page palette) instead of a dead popover.
- ⌘K while the New Form page, Settings overlay, or Add Project modal is open:
  no-op — the shortcut only fires on thread-bearing surfaces.
- Submitting or dismissing the draft works identically to drafts created from
  the Forms page (it's the same `DraftCard` path).
