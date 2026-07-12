# Ticket 69 — Schedule a Form from the Calendar by Clicking a Day

## Goal

The Calendar page ([CalendarPage.tsx](../src/mainview/components/CalendarPage.tsx))
is read-only today: it shows scheduled runs, but creating one requires
leaving for a form card's ⋯ → Schedule flow (the empty state even says so).
Let the user **add a form directly from the calendar**: click a day, pick a
form, fill its inputs, and it's scheduled **for that day automatically** —
the clicked date is the point.

## Acceptance criteria

### 1. Day-cell affordance

- Hovering a day cell shows a small **"+"** affordance (top-right of the
  cell, matching the calendar's quiet visual language); clicking it — or
  clicking the cell's empty area — opens the schedule composer for that
  date. Clicking an existing chip still opens `ScheduleDetail`, unchanged.
- Out-of-month (dimmed) cells work too — clicking one composes for that
  date; whether the view navigates to that month is cosmetic, the date must
  be right.

### 2. Schedule composer

- A composer panel opens below the grid (same placement/styling as
  `ScheduleDetail`), for the clicked date:
  - **Form picker**: searchable list of the active project's forms (reuse
    [useFormSearch](../src/mainview/hooks/useFormSearch.ts) — same ranking
    as the ⌘K palette).
  - **The form's real fields**, rendered via
    [FormCardBody.tsx](../src/mainview/components/FormCardBody.tsx) so
    types/options/magic-sparkles look exactly like the card. Magic fields
    auto-fill on selection (same `fillMagicFields` path as `autoFill`),
    values always editable.
  - **Date** (prefilled with the clicked day, editable), **time** (default
    09:00), **repeat** (`none`/`daily`/`weekly`) — same controls as
    `ScheduleDetail`.
- **Schedule** submits via the existing `scheduleRun` in
  [AppContext.tsx](../src/mainview/context/AppContext.tsx) — no backend
  changes; the scheduler and per-status calendar chips already handle the
  rest. The new chip appears on the clicked day immediately.
- Required-field gating matches the form card: Schedule is disabled until
  every required field is filled.

### 3. Past dates

- Composing on a date/time in the past disables Schedule with an inline
  "that's in the past" note (the scheduler treats overdue runs as
  fire-immediately on its next tick — silently scheduling into the past
  would surprise-run the form). Today's date defaults to the next full hour
  instead of 09:00 when 09:00 already passed.

## Files to modify

- `src/mainview/components/CalendarPage.tsx`
- New: `src/mainview/components/CalendarComposer.tsx` (picker + fields +
  date/time/repeat)
- `src/mainview/components/FormCardBody.tsx` (only if reuse needs a prop
  tweak — no visual changes to real cards)

## Edge cases

- Project with zero forms: the composer shows an empty-state pointing at
  the form-creation wizard instead of a dead picker.
- Switching the picked form mid-compose resets field values (and re-runs
  magic fill) — stale values from the previous form must not leak into the
  new form's inputs.
- Only one composer at a time; opening it closes any open `ScheduleDetail`,
  and vice versa.
- A form whose card would auto-fill magic fields must not block Schedule
  while fills are pending — pending fills show the existing shimmer and the
  user can overwrite or wait.

## Note

Complements ticket 47 (scheduling CRUD & calendar). Pure renderer work —
`scheduleRun`, chips, and projections all exist.
