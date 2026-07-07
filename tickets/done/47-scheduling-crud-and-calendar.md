# Ticket 47 — Scheduling: Fix, Full CRUD & Calendar Surface

## Goal

Scheduling a form ([ScheduleSubForm.tsx](../src/mainview/components/ScheduleSubForm.tsx)
→ `scheduleRun` → [scheduler.ts](../src/bun/scheduler.ts)) doesn't work at
all right now. Fix it, then treat schedules as a first-class managed thing:
full CRUD over scheduled runs, and a **Calendar** surface on the project
toolbar showing everything scheduled at a glance.

## Acceptance criteria

### 1. Fix the pipeline first

- Diagnose end-to-end why a scheduled run never fires/appears: the
  `ScheduleSubForm` → `api.scheduleRun` RPC, `schedule()` persisting the run,
  `arm()` timers, `initScheduler` on boot, and the status push back to the
  renderer. Write down the root cause in the PR.
- A run scheduled 2 minutes out fires while the app is open; a run scheduled
  in the past (app was closed) fires on next launch; daily/weekly repeats
  re-arm. All three verified manually.
- Known wart to fix while in there: `cancelScheduled` marks the run
  `"error"` — cancelled is not an error. Either delete the run or introduce
  a distinct terminal state.

### 2. Schedule CRUD

- A management surface listing every scheduled run for the project —
  upcoming first — showing form name, next fire time, repeat interval, and
  the filled inputs (summary).
- Per row: **edit** (change date/time and repeat — new `updateScheduledRun`
  RPC that rewrites the run and re-arms its timer), **run now**, and
  **cancel/delete** (clears the timer and removes the scheduled run).
- Editing a recurring schedule affects the pending occurrence and the
  recurrence going forward (there is only ever one pending row per series
  today — keep that model).

### 3. Calendar surface on the project toolbar

- `ProjectSurface` gains `"calendar"`; the project toolbar
  ([ProjectToolbar.tsx](../src/mainview/components/ProjectToolbar.tsx)) gets
  a **Calendar** button (between Views and Settings).
- The surface is a month grid (page pattern from ticket 39: full-width,
  pinned header, prev/today/next controls). Each day cell lists its
  scheduled runs as compact chips (form name + time); recurring runs project
  their future occurrences forward within the visible month, visually
  distinguished (e.g. muted/striped) from concretely persisted ones.
- Clicking a chip opens the CRUD affordances (edit / run now / cancel) — a
  small popover is fine. The CRUD list from §2 can live on this same surface
  (e.g. an agenda column or a list toggle) rather than being a separate page
  — one Calendar destination covers both.

## Files to modify

- `src/bun/scheduler.ts`, `src/bun/db/history.ts`, `src/bun/index.ts`
- `src/shared/types.ts` (`updateScheduledRun`, cancel semantics)
- `src/mainview/rpc.ts`, `src/mainview/context/AppContext.tsx`
  (`ProjectSurface` + new actions)
- `src/mainview/components/CalendarPage.tsx` (new)
- `src/mainview/components/ProjectToolbar.tsx`, `App.tsx`
- `src/mainview/components/ScheduleSubForm.tsx` (fixes only)

## Edge cases

- Timers must be re-armed after edit and cleared on delete — no orphan
  `setTimeout` firing a cancelled run.
- Months with 40+ scheduled chips in one day: cells cap visible chips with a
  "+N more" overflow.
- DST boundaries: fire times are stored as ISO instants; the calendar
  renders them in local time — a daily 9:00 repeat may drift an hour across
  DST with the current naive `+1 day` math. Note it; fixing recurrence to be
  wall-clock-aware is in scope only if cheap.
- Deleting a form with pending schedules: cancel its scheduled runs.
