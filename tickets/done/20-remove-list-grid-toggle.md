# Ticket 20 — Remove the List/Grid View Toggle (For Now)

## Goal

Remove the list ⇄ grid view toggle from the UI. The thread (list) becomes the
only presentation. Grid view code is **retired from the render path**, not
deleted — we may bring it back later behind the views system (ticket 19).

## Background

- `viewMode: "list" | "grid"` lives in
  [AppContext.tsx](../src/mainview/context/AppContext.tsx#L5) with
  `setViewMode` in the context value.
- [App.tsx](../src/mainview/App.tsx#L41) branches
  `{viewMode === "list" ? <Thread /> : <GridView />}`.
- The toggle button is rendered twice, in near-identical top-right corners:
  - [Thread.tsx](../src/mainview/components/Thread.tsx#L57-L64)
  - [GridView.tsx](../src/mainview/components/GridView.tsx#L136-L143)
- [GridView.tsx](../src/mainview/components/GridView.tsx#L120-L130) also calls
  `setViewMode("list")` internally (e.g. after opening a form from the grid).

## Acceptance criteria

- [App.tsx](../src/mainview/App.tsx) always renders `<Thread />`; the
  `viewMode` branch and the `GridView` import are removed.
- The toggle button block (the `List`/`LayoutGrid` icon button and its wrapper
  `div` at the top of the scroll area) is removed from
  [Thread.tsx](../src/mainview/components/Thread.tsx), along with the now-unused
  `viewMode`/`setViewMode` destructuring and `lucide-react` icon imports. If
  the wrapper `div` only existed for the toggle, remove it (watch spacing —
  keep the thread's top padding visually equivalent).
- `viewMode`, `setViewMode`, and the `ViewMode` type are removed from
  [AppContext.tsx](../src/mainview/context/AppContext.tsx) (state, context
  interface, provider value).
- [GridView.tsx](../src/mainview/components/GridView.tsx) and its satellites
  ([GridCard.tsx](../src/mainview/components/GridCard.tsx), grid layout RPC
  `readLayout`/`writeLayout`, [layout.ts](../src/bun/forms/layout.ts)) are left
  on disk but no longer imported anywhere in the render path. Fix or suppress
  any resulting unused-code compile errors _inside GridView.tsx only_ (e.g. it
  may still reference the removed `viewMode` — stub locally or comment; do not
  reshape AppContext for a dead component).
- `bunx tsc --noEmit` and `bunx vite build` pass.

## Files to modify

- `src/mainview/App.tsx`
- `src/mainview/components/Thread.tsx`
- `src/mainview/context/AppContext.tsx`
- `src/mainview/components/GridView.tsx` (only as needed to keep tsc green)

## Non-goals

- Deleting grid components, the `.layouts/` storage, or the layout RPC — leave
  data and backend untouched so grid can return later.

## Edge cases

- Users who were "in" grid view: `viewMode` was renderer-only state (never
  persisted), so nothing to migrate.
