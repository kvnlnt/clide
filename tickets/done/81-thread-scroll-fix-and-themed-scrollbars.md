# Ticket 81 — Body Scroll Fix on Run Expansion + Theme-Styled Scrollbars

## Goal

Two related scroll problems in the thread/view body:

1. **Expanding run items sometimes breaks body scrolling.** When a run card
   (or grouped submission accordion) is expanded inside a view, the main
   body scroll doesn't always respond — content grows but the pane can't
   always be scrolled to reach it.
2. **The body scrollbar isn't themed.** The default scrollbar clashes with
   the dark visual language. Every scrollbar in the app should match the
   theme.

## Acceptance criteria

### Scroll behavior

- Reproduce and root-cause the expansion case: likely a missing `min-h-0` /
  `overflow` link in the flex chain (same class of bug as ticket 68's
  settings fix) or a nested scroll container swallowing wheel events when a
  card's own output box (auto-size/resizable from tickets 46/72) sits under
  the cursor. Write the root cause in the PR.
- After the fix: with any run item expanded — including tall outputs and
  grouped accordions — the body scrolls reliably via wheel, trackpad, drag
  on the scrollbar, and keyboard (Space/PageDown when body has focus), in
  both the title tab and saved views.
- Inner output boxes may still scroll their own overflow, but reaching the
  end of an inner scroller hands off to the body scroll naturally (default
  browser chaining — just don't break it with overscroll traps).

### Themed scrollbars

- One canonical scrollbar treatment, defined once in
  [index.css](../src/mainview/index.css): thin, `transparent` track, thumb
  in white at low opacity (~`rgba(255,255,255,0.15)`), brightening on
  hover — matching the existing `.clide-scroll` treatment.
- Clean up the current styles while in there: the `scrollbar-color: red
  orange` debug rule at the top of index.css must go, and the
  `.clide-scroll` vs. global rules should collapse into one consistent
  system applied to **every** scrollable surface — thread body, settings,
  popovers, output boxes, forms panel, calendar agenda.
- Both WebKit (`::-webkit-scrollbar*`) and standard
  (`scrollbar-width`/`scrollbar-color`) properties, since Electrobun's
  webview is the only target but the standard props are the future-proof
  half.

## Files to modify

- `src/mainview/index.css`
- `src/mainview/components/Thread.tsx` /
  `SubmissionAccordion.tsx` / `FormCardBody.tsx` /
  `output/*` (whichever the root cause implicates)

## Edge cases

- Expanding a card near the bottom of the viewport: the body should either
  keep the header of the expanded card in view or at least remain fully
  scrollable to the new content — no dead zone.
- Resizable output boxes (ticket 46/72 handles) must not re-introduce the
  trap after a manual resize.
