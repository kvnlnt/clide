# Ticket 44 — Modern Card & Surface Restyle

## Goal

Thread cards and form surfaces sit on near-black fills (`clide-surface`
`#0f0d0d` is *darker* than the `#151212` window background), which reads as
heavy black boxes. Kill the black-box look: lower the contrast between cards
and the background, and modernize the spacing treatment. Cards should feel
like part of the page, not holes punched in it.

## Acceptance criteria

### 1. Palette

- Rework the `clide` tokens in
  [tailwind.config.js](../tailwind.config.js): `surface` becomes a *subtle
  lift above* `bg` (slightly lighter, low-contrast — think +3–5% lightness),
  not darker. Adjust `border` down too (`#3d3c3c` is currently the loudest
  line on screen; something like white at 6–8% reads calmer).
- Tokens change in one place; components keep using `bg-clide-surface` /
  `border-clide-border` so the sweep is mostly free. Audit for hardcoded
  hex/black fills that bypass the tokens and migrate them.

### 2. Card treatment ([FormCard.tsx](../src/mainview/components/FormCard.tsx))

- Expanded cards: the new low-contrast surface, softer border (or none —
  try border-free with the surface lift carrying the shape), slightly larger
  radius, more generous internal padding and consistent vertical rhythm
  between header / body / footer.
- Collapsed rows
  ([FormCardCollapsed.tsx](../src/mainview/components/FormCardCollapsed.tsx)):
  no filled box at all — transparent rows with a hover lift, consistent with
  the Forms/Views page row treatment from ticket 39.

### 3. Forms & inputs

- Inputs across the app currently use `bg-clide-surface` boxes (Forms page
  search, view toolbar popovers, settings fields, form fields in
  [FormField.tsx](../src/mainview/components/FormField.tsx)) — restyle to the
  new surface so they stop reading as black wells; focus state carries the
  emphasis instead of heavy resting borders.
- Thread spacing: revisit the gap between cards and date-group headers so
  the lighter cards breathe (current `gap-3` was tuned for boxed cards).

### 4. Consistency check

- One pass over Sidebar, popovers (`bg-clide-panel`), toolbars, and the
  Welcome screen to confirm nothing still reads as a black slab against the
  new values — `panel` may need the same nudge.
- Update the "Visual language" section in
  [00-overview.md](00-overview.md) — it still documents the old
  `#0a0a0a`/`#222121` card colors from the Figma; record the new values so
  future tickets don't regress to black cards.

## Files to modify

- `tailwind.config.js`
- `src/mainview/components/FormCard.tsx`, `FormCardCollapsed.tsx`,
  `FormCardHeader.tsx`, `FormCardBody.tsx`, `FormCardFooter.tsx`,
  `FormField.tsx`
- Spot fixes wherever the audit finds hardcoded dark fills
- `tickets/00-overview.md` (visual language section)

## Edge cases

- Output viewers inside cards (tables, images, raw text) were designed
  against the dark card fill — check they still have enough contrast on the
  lighter surface.
- The active-tab/toolbar fusion (tickets 34/35) depends on tab, toolbar, and
  pane sharing one background — if `bg` shifts, all three must shift
  together or the fusion illusion breaks.
