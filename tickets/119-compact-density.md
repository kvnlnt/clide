# Ticket 119 — Compact Density Pass

## Goal

The app is still too "spacious". Tighten margins/padding across the main
surfaces and provide compact presentations of the busiest screens so more
content fits on screen.

## Acceptance criteria

- A density pass over the main surfaces — thread cards
  ([TaskCard*.tsx](../src/mainview/components/TaskCard.tsx),
  [SubmissionAccordion*.tsx](../src/mainview/components/SubmissionAccordion.tsx)),
  Tasks page, Views page, Calendar, Settings — trimming oversized
  paddings, gaps, and vertical rhythm. Keep the ticket 44 "low-contrast
  lift" language; this is spacing, not color.
- Where a single tighter default isn't enough, offer a **compact view**
  of the screen (e.g. denser thread rows). Whether that's a global
  "Compact mode" toggle in Settings or per-surface is the implementer's
  call — but the choice must persist (uiState /
  [config.ts](../src/bun/config.ts)).
- Nothing becomes unreadable or unclickable: minimum hit targets stay
  sane; the visual language's opacity hierarchy still carries structure.
- Before/after screenshots on `dev:regular` for the thread, Tasks page,
  and Calendar accompany the PR.

## Files to modify

- Broad Tailwind-class sweep across `src/mainview/components/`;
  `src/mainview/index.css` for any shared spacing tokens
- `src/bun/uiState.ts` / `config.ts` if a persisted toggle is added

## Notes

Sibling of ticket 120 (full-width) — coordinate so the pages are measured
once. 119 is spacing within surfaces; 120 is the width of the surfaces.
