# Ticket 109 — Interview Draft Review Screen Can't Scroll

## Goal

The interview's review step ("Here's the draft — every section is yours
to edit before saving. Nothing is stored until you save.") must scroll;
today content below the fold is unreachable.

## Current behavior

[ProfileInterviewPage.tsx](../src/mainview/components/ProfileInterviewPage.tsx)
wraps phases in a `clide-scroll flex-1 overflow-y-auto` container
(~line 156), but in the `review` phase the scroll doesn't work — likely
the ticket-68 pattern: a flex ancestor missing `min-h-0`, so the scroll
container never actually constrains its height.

## Acceptance criteria

- The review phase scrolls with the themed scrollbar (ticket 81) when the
  drafted sections exceed the window height; the sticky footer actions
  (save/cancel) stay reachable.
- The `asking` and `drafting` phases still behave (no regression).
- Verify with a long draft (many sections, long text) on a small window.

## Files to modify

- `src/mainview/components/ProfileInterviewPage.tsx`
