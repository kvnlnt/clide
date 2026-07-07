# Ticket 48 — Pinning Is a View-Only Feature

## Goal

Pinning only has meaning inside saved views — the pinned bucket floats runs
to the top of a view's thread (ticket 27), while the title tab is strictly
chronological and ignores pins entirely. Yet the **Pin** action is offered
everywhere. On the main project (title) tab it's a dead switch. Hide it
there: pinning is only visible and actionable inside a view tab.

## Acceptance criteria

- The Pin/Unpin item in the card menu
  ([EllipsisMenu.tsx](../src/mainview/components/EllipsisMenu.tsx), reached
  from [FormCardHeader.tsx](../src/mainview/components/FormCardHeader.tsx)
  and [FormCardCollapsed.tsx](../src/mainview/components/FormCardCollapsed.tsx))
  is rendered **only when a view tab is active** (`activeViewId !== null`).
  On the title tab the menu simply omits it.
- Any pinned iconography on cards (pin markers, `pinned` styling) is likewise
  suppressed on the title tab — a run pinned inside some view shouldn't
  advertise it in the chronological thread.
- Inside views, nothing changes: pin/unpin, the "Pinned" bucket, and pinned
  styling all behave exactly as today.
- The underlying data is untouched — `pinned` stays on the run record and
  `setPinned` keeps working; this is purely a presentation/affordance gate.

## Files to modify

- `src/mainview/components/EllipsisMenu.tsx` (make the pin item optional)
- `src/mainview/components/FormCard.tsx` / `FormCardHeader.tsx` /
  `FormCardCollapsed.tsx` (thread the "in a view" flag — cheapest is reading
  `activeViewId` from `useApp()` at the FormCard level and passing a
  `showPin` prop down)

## Edge cases

- Grouped cards where the latest run is pinned: on the title tab the group
  renders as an ordinary chronological group (already the case per ticket
  27 — verify, don't regress).
- A run pinned from inside a view, then viewed on the title tab, then
  unpinned back in the view — no stale pin UI anywhere in between.
- `GridCard.tsx` still references pinning; the grid view is retired
  (ticket 20) but if the component is still reachable anywhere, apply the
  same gate — otherwise leave it for the eventual grid cleanup.
