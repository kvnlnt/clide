# Ticket 133 — Compact Mode: Tabs, Toolbars & Vertical Date Labels

## Goal

Compact mode (ticket 119) reaches the surfaces it currently skips — the
project view tabs and toolbars — and introduces the print-style
"vertical label" technique for dates in dense result lists. View tabs
also stop being width-constrained.

## Acceptance criteria

### 1. Compact tabs & toolbars

- [ViewTabs.tsx](../src/mainview/components/ViewTabs.tsx),
  [ViewToolbar.tsx](../src/mainview/components/ViewToolbar.tsx), and
  [ProjectToolbar.tsx](../src/mainview/components/ProjectToolbar.tsx)
  currently have zero `clide-compact` handling. In compact mode they
  tighten (row height / padding via the existing `--clide-*` density
  tokens in [index.css](../src/mainview/index.css) where possible).
- Toolbar tools collapse to icon-only in compact mode, with a hover
  tooltip supplying the label.

### 2. Full-width tabs

- View tabs stretch to fill available width: remove the per-tab
  `max-w-[200px]` / `max-w-[120px]` truncation caps in `ViewTabs.tsx`
  in favor of flex distribution (tabs share the row; truncation only
  when genuinely out of space).

### 3. Vertical date labels

- In compact mode, the date shown on task/workflow result rows docks
  left and rotates 90° (a vertical label rail, as in print layouts),
  reclaiming the horizontal space the date line occupied.
- Keep the technique reserved for repeated structural labels, not
  primary content. Candidate follow-ups (not this ticket): vertical
  day-group headers as a timeline gutter in grouped run lists,
  vertical column headers in dense tables.

## Files to modify

- `src/mainview/components/ViewTabs.tsx`, `ViewToolbar.tsx`,
  `ProjectToolbar.tsx`
- `src/mainview/index.css` (compact tokens, vertical-label utility)
- The result-row component rendering the date
  (`SubmissionAccordionRow.tsx` or its card header)

## Implementation

Compact handling in `ViewTabs`/`ViewToolbar`/`ProjectToolbar`/`Toolbar`
follows the same pattern the rest of the app uses for `.clide-compact`
(root-class + descendant CSS), extended from the ticket 119 density
*tokens* to full Tailwind rules: every tightened value is expressed as an
arbitrary variant, `[.clide-compact_&]:px-3` etc., which Tailwind compiles
to `.clide-compact .el { ... }` — no JS branching on `compactMode`, no
prop threading, consistent with how `.clide-compact` already cascades
from the app root. Verified the compiled CSS in a live dev-server tab
(`document.styleSheets` inspection) to confirm the arbitrary-selector
syntax actually produced the intended rules rather than trusting Tailwind
to accept it silently.

- **Toolbar tools → icon-only**: each text label in `ProjectToolbar` and
  the "Run" button in `ViewToolbar` is now wrapped in a `<span
  className="[.clide-compact_&]:hidden">`, so `display:none` removes it
  from layout (no leftover gap) while the icon stays. Every one of these
  buttons already carried a `title` attribute, so the "hover tooltip
  supplying the label" requirement was already satisfied for free — no
  new tooltip component needed. `ViewToolbar`'s filter chips (Task:/
  Status:/Keyword:) were left alone — they're active-filter *content*,
  not toolbar tools, so collapsing them would hide state rather than
  chrome.
- **Full-width tabs**: `tabShape` gained `flex-1` so the title tab and
  every view tab share the row and grow together; the `max-w-[200px]`
  / `max-w-[120px]` caps were removed since `min-w-0` + `truncate` on the
  label is now sufficient — the flex item itself shrinks under real space
  pressure and Tailwind's `truncate` only engages then.
- **Vertical date labels**: added a reusable `.clide-vertical-label`
  utility in `index.css`, scoped entirely under `.clide-compact` (a no-op
  outside compact mode). It sets `order: -1` to dock the label at the
  start of its flex row without touching sibling elements' markup,
  `writing-mode: vertical-rl` + `rotate(180deg)` for the print-spine
  read-bottom-to-top look, and `align-self: stretch` so it fills the
  row's height. Applied only to the timestamp span in
  `SubmissionAccordionRow.tsx` — kept off the summary text per the
  ticket's "structural labels, not primary content" guidance. The class
  is a general utility (not baked into the row component), so the
  candidate follow-ups (day-group headers, dense table column headers)
  can reuse it directly.

Not deeply exercised end-to-end: the dev server available in this
environment was mid-onboarding-wizard with no seeded project, so tabs/
toolbars/result rows with real data weren't visually walked in compact
mode. Confirmed via `tsc --noEmit` (clean) and by inspecting the actual
compiled CSSOM rules for every new class used, which is a stronger
guarantee than usual for Tailwind arbitrary-variant syntax but still not
a substitute for eyeballing the layout live — worth a quick look on
`dev:regular` before fully trusting the row-height feel and tab
distribution.
