# Ticket 113 — Task List Row Click Must Not Create a Run Draft

## Goal

Clicking a task's row/header in the Tasks page must not open a new task
card. The Tasks page is for **managing** tasks, not creating or running
them — today a click drops a draft run card into the thread, which reads
as "the app just opened a new task" and confuses.

## Current behavior

In [TasksPanel.tsx](../src/mainview/components/TasksPanel.tsx), the row's
main button (`onSelect`) calls `addFormDraft(form.meta.slug)` via
`choose()` — same for Enter on a highlighted result. That injects a draft
submission card into the project thread.

## Acceptance criteria

- Clicking a row selects/manages the task instead — open the row's edit
  surface (the same one ticket 112 enriches), or at minimum do nothing
  destructive/creative. Decide one behavior and apply it to click *and*
  Enter-on-highlighted-row.
- Running a task remains available where it belongs: the ⌘K picker and
  Quick-Run (ticket 42). If an explicit per-row "Run" affordance is
  wanted, make it a clearly labeled button, never the row body.
- The "Create Task" entry (the `Plus` row) keeps its current behavior —
  creation via that explicit affordance is fine.

## Files to modify

- `src/mainview/components/TasksPanel.tsx`
