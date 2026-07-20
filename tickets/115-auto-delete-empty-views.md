# Ticket 115 — Auto-Delete Views With No Filters

## Goal

A view tab with no filters applied is indistinguishable from the title
tab and has no reason to exist. Remove filterless views automatically
instead of letting them accumulate.

## Acceptance criteria

- A view whose `filters` object is empty (no task filter, no status, no
  keyword — the `ThreadView` shape in
  [views.ts](../src/bun/tasks/views.ts) / `shared/types.ts`) is deleted
  automatically once the user is done with it: when its tab is
  deactivated or closed, or at app/project load for stale ones. It must
  **not** vanish while the user is actively on the tab configuring it —
  a just-created ⌘T tab (ticket 83) needs its grace period.
- Deletion follows ticket 82 focus rules (activate left neighbor).
- No confirmation dialog — there's nothing to lose by definition. But it
  should feel like cleanup, not data loss; if the user set a custom name
  on the view, keep it (a named-but-filterless view is intentional —
  see ticket 116's explicit-name flag).

## Files to modify

- `src/mainview/context/AppContext.tsx` (view lifecycle),
  `src/mainview/components/ViewTabs.tsx`
- `src/bun/tasks/views.ts` if cleanup happens at read time too
