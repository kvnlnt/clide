# Ticket 72 — Result Outputs Shrink to Fit

*(Documented retroactively — implemented on request alongside tickets 64-69.)*

## Goal

Text, JSON, and Table result renderers used a hard-coded `height: 400px`,
so a two-line result floated in a mostly empty box. Results should size to
their content — many outputs are tiny.

## What was done

- New shared
  [AutoSizeOutput.tsx](../../src/mainview/components/output/AutoSizeOutput.tsx)
  container, adopted by `TextOutput`, `JsonOutput`, and `TableOutput`:
  - small results hug their content (40px floor);
  - content taller than **400px** caps there and scrolls (the old fixed
    height becomes a ceiling);
  - the manual resize handle still works past the cap: when the browser
    writes an inline height during a drag, a `MutationObserver` lifts the
    cap to the old **1000px** drag ceiling — without this, `max-height`
    would have silently clamped the ticket-46 enlarge ability at 400px.
- Media outputs untouched (image/video already scale naturally, audio is a
  fixed bar). Streaming output grows the box live until the cap, then
  scrolls.
