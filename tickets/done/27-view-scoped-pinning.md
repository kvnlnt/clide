# Ticket 27 — Pinning Is a View Concern

## Goal

Pinned runs should not reorder the main (title) tab, which shows everything
chronologically. Pinning stays as a run flag and remains meaningful **inside
views** — via the `pinnedOnly` filter and pinned-first ordering there.

## Current behavior

[useThread.ts](../src/mainview/hooks/useThread.ts) always floats pinned runs
to the top and buckets them under a "Pinned" date label — regardless of
whether the implicit title tab or a saved view is active.

## Acceptance criteria

1. **Title tab** (`activeViewId === null`): pure reverse-chronological order.
   No pinned-first sort, no "Pinned" bucket. Pinned runs appear in their
   natural date position (pin icon on the card still shows state).
2. **Saved views** (`activeViewId !== null`): current behavior kept — pinned
   runs float to top under the "Pinned" bucket, and the `pinnedOnly` filter
   continues to work.
3. Pin/unpin actions remain available everywhere (FormCard menu unchanged).
4. Draft-card and coalescing behavior unaffected on the title tab (pinned
   runs may now coalesce with neighbors like any other run when on the title
   tab — acceptable; keep standalone behavior inside views).

## Files to modify

- `src/mainview/hooks/useThread.ts` — make pinned sort/bucket conditional on
  an active view.

## Edge cases

- A view with no filters: still a "view", so pinned float applies there —
  that's the escape hatch for users who want the old behavior.
