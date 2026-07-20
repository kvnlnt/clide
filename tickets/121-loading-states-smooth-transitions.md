# Ticket 121 — Kill FOUC: Loading States & Smooth Screen Transitions

## Goal

No more flashes of unstyled/unpopulated content. The app gets a proper
loading animation at launch, and switching between surfaces/screens is
animated instead of hard-cutting.

## Acceptance criteria

### 1. App launch

- A branded loading state covers the window from first paint until the
  UI is styled and hydrated — no flash of raw/unstyled content. Audit the
  Vite/Electrobun boot path ([index.html](../src/mainview/index.html),
  [main.tsx](../src/mainview/main.tsx)): inline critical background
  color/spinner in the HTML shell so even the pre-React moment is on-theme
  (`#151212`).
- The welcome/first-run takeovers keep their existing staggered entrances
  (ticket 29) — the loader hands off to them cleanly.

### 2. Surface transitions

- Switching `ProjectSurface` (thread ⇄ tasks ⇄ views ⇄ calendar ⇄ files ⇄
  settings — [AppContext.tsx](../src/mainview/context/AppContext.tsx)),
  switching view tabs, and entering/leaving full-window takeovers animate
  (fade/slide, ~150–250ms, consistent easing). One shared transition
  primitive, not per-page one-offs.
- Async page content (run history, files, views) shows an on-theme
  skeleton or spinner instead of flashing empty then popping in.

### 3. Discipline

- Respect `prefers-reduced-motion`.
- Transitions never block input — a slow AI call must not freeze
  navigation behind an animation.

## Files to modify

- `src/mainview/index.html`, `main.tsx`, `index.css`,
  `App.tsx`/`AppContext.tsx` (surface switch point), shared transition
  component under `src/mainview/components/`

## Notes

This is the bug-fix/polish floor; ticket 122 (signature motion design)
builds the ceiling on top of it. Land this first.
