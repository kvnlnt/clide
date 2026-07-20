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

## Implementation

Introduced a density-scale CSS custom-property system in `index.css`
(`--clide-page-x/top/bottom`, `--clide-card-x/y`, `--clide-row-y/gap`)
consumed via arbitrary Tailwind values (`px-[var(--clide-page-x)]`)
across the page-header/body pattern (Tasks, Views, Calendar, Settings,
Project Settings, Files, and the wizard/interview full-window pages that
share the same shell), the TaskCard family (header/body/footer), and row
containers (SubmissionAccordionRow, TasksPanel row, ViewsPage row, Thread
card gap). Root defaults are already ~15-20% tighter than the old
hardcoded values, satisfying the "trim oversized paddings" baseline
everywhere they're used — a single systemic fix rather than a per-file
guess-and-check sweep.

A persisted **Compact mode** toggle (Settings → Appearance,
`UIState.compactMode` in `uiState.ts`/`AppContext.tsx`) applies a
`.clide-compact` class to the app root that overrides those same
variables for a denser layout, satisfying "offer a compact view" without
threading a boolean prop through every consuming component — CSS
variables cascade to the toggle's descendants (including the absolutely
positioned full-window overlays) for free.

Not produced: the before/after screenshots on `dev:regular` the ticket
asks for — no way to drive the running Electrobun app visually from this
environment. Verified via `tsc --noEmit` and reasoning about resulting
row heights against a sane minimum hit-target; worth a live look before
fully trusting the compact-mode feel.
