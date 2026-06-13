# Ticket 11 — Pin & Schedule

## Goal
Let users pin forms to the top of the thread and schedule forms to run at a future time or on a recurring basis.

## Acceptance criteria
- Each collapsed FormCard row has an ellipsis menu with options: **Pin**, **Schedule**, **Re-run**, **Delete**
- Pinned forms float to the top of the history section (below the active card) in all views
- Pin state is persisted in the run record (a `pinned: boolean` field in SQLite)
- Scheduling opens a sub-form (inline, no modal) on the FormCard with fields: **Run at** (datetime picker) and optionally **Repeat** (none / daily / weekly)
- Scheduled runs show with the alarm-clock icon and the scheduled time as summary text
- At the scheduled time, the Bun main process triggers the run automatically (uses `setTimeout` for one-offs; a persistent cron-like loop for recurring)
- If the app is closed when a scheduled run is due, it runs on next launch with a "ran late" note
- Scheduled/pinned state is visually indicated in both list and grid views

## Visual spec (from Figma)
- Pin icon: `pin` (Lucide), 20px, replaces the status icon on the left of a collapsed row
- Alarm-clock icon: `alarm-clock` (Lucide), 20px, for scheduled runs
- Ellipsis menu: standard dropdown, dark bg `#222121`, border `#3d3c3c`, 14px text

## SQLite additions (extends ticket 02 schema)
```sql
ALTER TABLE runs ADD COLUMN pinned INTEGER DEFAULT 0;
ALTER TABLE runs ADD COLUMN scheduled_at TEXT;
ALTER TABLE runs ADD COLUMN repeat_interval TEXT;  -- null | 'daily' | 'weekly'
```

## Files to create/modify
- `src/mainview/components/FormCardMenu.tsx` — ellipsis dropdown menu
- `src/mainview/components/ScheduleSubForm.tsx` — inline schedule picker
- `src/bun/scheduler.ts` — manages scheduled run timers, persists across restarts
- `src/bun/db/history.ts` — add pin/schedule fields
