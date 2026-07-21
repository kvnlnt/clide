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
