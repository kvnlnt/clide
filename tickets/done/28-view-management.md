# Ticket 28 — View Management & Scalable Form Picker

## Goal

Make many views manageable and make the view editor scale to many forms:

1. Views (and where you were) survive an app restart.
2. Tabs can be **hidden/unhidden, sorted, and pinned** in addition to the
   current edit/delete.
3. The forms checkbox list in the view filter editor becomes a searchable
   picker that scales to hundreds of forms.

Depends on tickets 25/26 settling the tab strip.

## Acceptance criteria

### 1. Restart persistence

- View definitions already persist per-project in `forms/.views.json` — keep.
- NEW: persist UI state globally (same config dir as `projects.json`, file
  `uiState.json`) via `getUIState` / `saveUIState` RPC:
  `{ activeProject: string | null, activeViewByProject: Record<string, string> }`.
- On launch, [AppContext.tsx](../src/mainview/context/AppContext.tsx) restores
  the last active project and, after its views load, the last active view for
  it (fall back to title tab if the view no longer exists).

### 2. View schema

- [types.ts](../src/shared/types.ts) `ThreadView` gains
  `hidden?: boolean` and `pinned?: boolean`; array order = display order.
- [views.ts](../src/bun/forms/views.ts) validation accepts and preserves the
  new optional fields.

### 3. Tab strip & manager

- [ViewTabs.tsx](../src/mainview/components/ViewTabs.tsx): pinned views render
  first (with a small pin glyph), then the rest in array order; hidden views
  don't render.
- A **manage-views button** (e.g. `SlidersHorizontal` icon after "+") opens a
  popover listing ALL views (hidden included), each row with:
  - name (click = activate + close popover)
  - pin toggle, hide/show toggle (Eye/EyeOff)
  - move up / move down
  - delete (existing behavior)
- Activating a hidden view from the manager unhides it.
- Hiding the active view falls back to the title tab.

### 4. Scalable form picker

- In [ViewFilterEditor.tsx](../src/mainview/components/ViewFilterEditor.tsx),
  replace the checkbox list with: selected forms as removable chips + a
  filter input that live-searches project forms (name/slug substring) and
  shows a capped (~8) result list; click or Enter adds. Empty selection =
  all forms (unchanged semantics).

## Files to modify

- `src/shared/types.ts`, `src/bun/forms/views.ts`, `src/bun/index.ts` (+
  `src/bun/config.ts` or a small `uiState.ts` for the global file),
  `src/mainview/rpc.ts`, `src/mainview/types/forms.ts`
- `src/mainview/context/AppContext.tsx`, `ViewTabs.tsx`,
  `ViewFilterEditor.tsx` (+ new `ViewManager.tsx` popover)

## Edge cases

- Restored project no longer registered → fall back to null cleanly.
- `.views.json` written by older version (no hidden/pinned) → loads fine.
- Reordering with pinned views: pinned group and unpinned group each keep
  internal array order; up/down moves within the whole array (pin wins for
  display grouping).
