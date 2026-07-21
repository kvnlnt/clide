# Ticket 129 — Recurring Series: Delete Occurrence vs. Delete Series

## Goal

Deleting one occurrence of a recurring task or workflow no longer kills
the whole series. The standard calendar-app pattern applies: "delete
this occurrence" and "delete the entire series" are separate, explicit
choices.

## Acceptance criteria

### 1. Series concept in the data model

- Today both [scheduler.ts](../src/bun/scheduler.ts)'s
  `cancelScheduled(runId)` and
  [schedules.ts](../src/bun/workflows/schedules.ts)'s
  `cancelScheduledWorkflowRun(projectPath, id)` delete a single row —
  and because the model only ever materializes "the next occurrence" as
  a row (the next one is created when the current fires), cancelling it
  ends all future repeats. Introduce a real series/recurrence concept:
  either a series id + skip-list of excluded occurrence dates, or a
  proper recurrence rule the projector reads — such that cancelling one
  occurrence advances/skips rather than terminates.
- Existing on-disk scheduled entries keep working (disk-format-firewall
  discipline: migrate or tolerate the old single-row shape; document
  the choice).

### 2. UI choice

- Cancelling a recurring occurrence from
  [CalendarPage.tsx](../src/mainview/components/CalendarPage.tsx)'s
  `ScheduleDetail` (and anywhere else cancellation surfaces) presents
  "Delete this occurrence" vs. "Delete the series" — replacing the
  current confirm copy that warns future repeats die too.
- Non-recurring entries keep the simple single confirm.

### 3. Projection stays honest

- `projectOccurrences()`-driven dashed future chips respect skipped
  occurrences (a deleted occurrence disappears; the rest of the series
  remains).

## Files to modify

- `src/bun/scheduler.ts`, `src/bun/workflows/schedules.ts`,
  `src/shared/types.ts` (series/skip fields, RPC scope parameter),
  `src/bun/index.ts`
- `src/mainview/components/CalendarPage.tsx`, `src/mainview/rpc.ts`
