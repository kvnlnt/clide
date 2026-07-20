# Ticket 122 — Signature Motion & UX Flair

## Goal

Give CLIDE distinctive animation and interaction behavior that makes the
product stand out — beyond the correctness floor of ticket 121, this is
the personality layer.

## Direction (to be explored, not prescribed)

- A motion identity: consistent signature easing/choreography so CLIDE
  movement is recognizable (the ✦ command-input mark is a natural motif).
- Moments worth elevating: run submission (card entering the thread),
  status changes (running → success/error via the `STATUS_META` colors),
  workflow step progression, badge count changes, drag-drop tool
  registration, calendar scheduling.
- Micro-interactions on hover/press for primary affordances; satisfying,
  quick, never gratuitous.

## Acceptance criteria

- A short motion-design note (in-repo, e.g. appended to
  [00-overview.md](00-overview.md)'s visual language) defining durations,
  easings, and principles — so future work stays coherent.
- At least the thread-card entrance, status transitions, and one
  "delight" moment (implementer's pick) shipped to that spec.
- Built on the ticket 121 primitives; respects `prefers-reduced-motion`;
  no jank on a seeded `dev:power` profile with a long thread.

## Files to modify

- `src/mainview/components/` (thread/card components, statusIcon),
  `index.css` / Tailwind config for shared keyframes

## Notes

Deliberately open-ended — treat as a design-led ticket. Depends on 121.
