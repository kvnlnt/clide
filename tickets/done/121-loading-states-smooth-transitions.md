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

## Implementation

1. **Boot shell**: `index.html` inlines `#151212` background + a static
   `.clide-boot` mark (pulsing "CLIDE" wordmark, `prefers-reduced-motion`
   aware) directly in the HTML, before any JS/CSS loads. React's
   `createRoot(...).render()` replaces `#root`'s children wholesale on
   mount, so the shell disappears the instant the app is ready with no
   extra handoff code — the first-run staggered entrance underneath is
   untouched.
2. **Surface transitions**: one shared primitive,
   `src/mainview/components/SurfaceTransition.tsx` — a `key`-based
   remount wrapper triggering a 180ms fade+rise (`.clide-surface-transition`
   in `index.css`). Wired into `App.tsx` at the two content-swap points:
   view-tab switches (keyed by view id, toolbar+thread together since a
   different view is a different page) and `ProjectSurface` switches
   (keyed by surface, wrapping only the swapped body so the persistent
   `ProjectToolbar` doesn't re-animate on every click).
3. **Takeover transitions**: a second primitive class,
   `.clide-takeover-transition` (220ms, distinct from the lighter surface
   fade), applied directly to all five full-window overlay divs in
   `App.tsx` (Settings, AI wizard, task wizard, workflow editor, profile
   interview).
4. **Skeleton for async content**: `AppContext.tsx` tracks `viewsLoading`
   during the per-project views fetch; `ViewsPage.tsx` shows three pulsing
   placeholder rows instead of flashing "No saved views yet" while it's in
   flight. (`FilesPage.tsx` already gained a loading state in ticket 118.)
   Scoped to views specifically — instrumenting every async data source
   in AppContext (tasks, runs, workflows) was out of reach for this pass.
5. **Discipline**: `prefers-reduced-motion` disables all animation classes
   via one media query; every transition is a CSS `opacity`/`transform`
   animation with no `pointer-events` manipulation, so navigation and
   async work underneath are never blocked.

Set up `.claude/launch.json` (Vite dev server, port 5173) and used it to
verify this live: the app boots with no white flash, the boot shell hands
off cleanly to the first-run onboarding flow (ticket 111), and no console
errors beyond the expected "Electroview unavailable" warning (the
renderer degrades gracefully outside the native Electrobun bridge, as
designed). Couldn't reach Tasks/Views/Calendar through the UI this way —
those need a real project, which needs the native bridge — so the
surface-transition and skeleton pieces are verified by `tsc` and code
reading only, not live in the browser.
