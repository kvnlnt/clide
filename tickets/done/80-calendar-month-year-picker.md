# Ticket 80 — Calendar "Month Year" Label Becomes a Date Picker

## Goal

The month label in the top right of the calendar
([CalendarPage.tsx](../src/mainview/components/CalendarPage.tsx) — the
`toLocaleDateString` "July 2026" text) is display-only; reaching a date far
in the past or future means hammering the ‹ › arrows one month at a time.
Make the label itself a **picker** so any month/year is a couple of clicks
away.

## Acceptance criteria

- The "Month Year" text becomes an interactive control (hover affordance +
  chevron so it's discoverable), opening a compact popover
  ([PortalPopover.tsx](../src/mainview/components/PortalPopover.tsx) pattern).
- Popover contents: a **12-month grid** for the displayed year with ‹ year ›
  steppers above it (the familiar month-picker idiom). Clicking a month
  closes the popover and jumps the grid to that month. The current real
  month and the currently-viewed month are visually marked.
- Year navigation must be fast for big jumps: at minimum the year steppers;
  ideally the year label is itself clickable to a year grid (decade view) —
  in scope if cheap.
- Keyboard: popover opens focused, arrows move the month highlight, Enter
  selects, Escape closes (shared Modal/popover Escape behavior from
  ticket 75 applies).
- Existing ‹ / Today / › controls keep working exactly as they do now.
- Styling follows the visual language: `clide-panel` popover, soft border,
  white-opacity text tiers.

## Files to modify

- `src/mainview/components/CalendarPage.tsx`
- possibly a small new `MonthYearPicker.tsx` component

## Edge cases

- Jumping to a distant month with recurring schedules: occurrence
  projection (ticket 47) must render correctly for far-future months, not
  just adjacent ones.
- Popover near the window edge: PortalPopover placement should keep it
  fully on-screen.
