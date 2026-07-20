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

## Implementation

Motion-design note appended to `00-overview.md`'s visual language
(one signature easing `--clide-ease`, duration bands, the ✦ mark as the
delight motif, "status changes get a moment not a snap" principle). All
existing hardcoded easings (`clide-rise`, the ticket-121 transitions)
consolidated onto the shared `--clide-ease` variable.

Three concrete pieces, each keyed to fire exactly once per real event
rather than on every re-render:

- **Thread-card entrance** — `.clide-card-enter` (240ms, scale+rise,
  slightly more pronounced than the ticket-121 surface fade since a
  submission is a bigger moment than navigation) applied directly to
  `TaskCard.tsx`'s root; plays on mount only, since React keeps the DOM
  node alive across re-renders unless its key changes.
- **Status transitions** — `.clide-status-pulse` (320ms scale pop)
  applied centrally inside `StatusIcon` (`statusIcon.tsx`), keyed by
  `status` so a value CHANGE (running → success) remounts the icon and
  replays the pulse everywhere `StatusIcon` is used, while re-renders at
  the same status don't retrigger it — one fix, every consumer benefits.
- **Delight moment** — `.clide-press` on the primary SEND/Cancel buttons
  in `TaskCardFooter.tsx`: a quick `:active` scale-down, no JS needed.

All new classes respect `prefers-reduced-motion` via the existing shared
media query in `index.css`; everything animates `opacity`/`transform`
only, so nothing blocks input.

While in `TaskCardFooter.tsx`/`TaskCardMenu.tsx`/`TaskPreview.tsx` for
this ticket, fixed three more ticket-96/114 rename stragglers these
files still had internally (`FormCardFooter`→`TaskCardFooter`,
`FormCardMenu`→`TaskCardMenu`, `FormPreview`→`TaskPreview`) — small,
safe, self-contained since they're each a single default export's
internal name.

Verified via `.claude/launch.json`'s Vite dev server: app still boots
and renders with zero console errors after these changes. Couldn't
visually confirm the card-entrance/status-pulse animations themselves —
they need a real run in the thread, which needs the native bridge and a
real project — so those are `tsc`-checked and code-read only, not eyes-on.
