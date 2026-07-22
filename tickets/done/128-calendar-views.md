# Ticket 128 — Calendar Views: Day / Week / Month / Agenda

## Goal

The calendar grows the normative view set users expect from Google
Calendar-class apps: Day, Week, Month, and a List/Agenda view — the
agenda view doubling as the "show me everything recurring/upcoming"
list that's currently impossible to get without scanning the month
grid.

## Acceptance criteria

### 1. View switcher

- [CalendarPage.tsx](../src/mainview/components/CalendarPage.tsx) gains
  a Day / Week / Month / Agenda switcher. Month is the existing grid;
  Day and Week are time-axis layouts of the same chips; Agenda is a
  flat chronological list of upcoming occurrences with recurring items
  clearly marked (this satisfies the original "list of all recurring
  tasks/workflows" ask).
- The selected view persists (uiState) and a "Today" button jumps back
  to the current period. Keyboard paging between periods (arrows or
  `[` / `]`), guarded by the existing overlay-open shortcut rules.

### 2. Density & filtering

- Crowded days in Month view collapse to "+N more" with a popover/day
  drill-in (needed once Day view exists as the drill-in target).
- A filter/legend distinguishes tasks vs. workflows (and project, when
  a cross-project surface applies) — the chip types already exist
  (`RunRecord` schedules vs. `ScheduledWorkflowRun`s).

### 3. Scheduling stays first-class

- Day-click (and empty-slot click in Day/Week) opens the existing
  [CalendarComposer.tsx](../src/mainview/components/CalendarComposer.tsx)
  to pick a task or workflow to schedule — verify the picker feels
  first-class from every view, not just Month.

### 4. Stretch (may split out if large)

- Drag-to-reschedule a chip to a new day/slot, writing back through the
  existing scheduler RPCs ([scheduler.ts](../src/bun/scheduler.ts) /
  [schedules.ts](../src/bun/workflows/schedules.ts) reschedule paths).
  If this balloons, land the views and split dragging into a follow-up.

## Files to modify

- `src/mainview/components/CalendarPage.tsx` (+ new view subcomponents
  as needed), `CalendarComposer.tsx`
- `src/bun/uiState.ts` / `src/shared/types.ts` (persisted view choice)
