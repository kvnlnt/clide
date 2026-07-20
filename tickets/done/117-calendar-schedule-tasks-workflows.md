# Ticket 117 — Calendar Schedules Workflows Too

## Goal

The calendar should let the user pick and schedule a **task or a
workflow**. Today the day-click composer (ticket 69) only schedules
tasks; workflows can only run via their own triggers.

## Acceptance criteria

- Clicking a day in [CalendarPage.tsx](../src/mainview/components/CalendarPage.tsx)
  opens the composer ([CalendarComposer.tsx](../src/mainview/components/CalendarComposer.tsx))
  with a picker spanning both tasks **and** workflows — same combined
  search behavior ⌘K gained in ticket 93.
- Picking a workflow collects its manual-trigger params (ticket 90) the
  way picking a task collects its fields, then schedules it for that
  date/time.
- Scheduled workflow runs appear on the calendar grid, visually
  distinguishable from scheduled task runs; edit/delete works for both
  through the existing modal flows (ticket 74).
- Scheduler ([scheduler.ts](../src/bun/scheduler.ts)) fires the workflow
  through the ticket 89 engine at the scheduled time; repeat intervals
  work the same as for tasks.

## Files to modify

- `src/mainview/components/CalendarPage.tsx`, `CalendarComposer.tsx`
- `src/bun/scheduler.ts`, `src/bun/workflows/engine.ts` (entry point),
  `src/shared/types.ts` (scheduled-item type gains a workflow variant)
