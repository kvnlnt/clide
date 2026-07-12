# Ticket 74 — Calendar Modals; Confirm Dialogs & Result Toasts Everywhere

*(Documented alongside implementation.)*

## Goal

Two UX complaints: (1) the calendar's schedule composer rendered below the
grid where long forms ran off-screen unscrollably — it and the schedule
editor should be modals; (2) confirmations were scattered inline
("Delete?" swap-in buttons) — every confirmation should be a popup dialog,
and every confirmed action should announce its result in a toast.

## What was done

### Shared infrastructure

- New [UIFeedback.tsx](../../src/mainview/components/UIFeedback.tsx):
  `UIFeedbackProvider` + `useUIFeedback()` exposing
  `confirm(opts): Promise<{ok, checked}>` (popup dialog with title, message,
  optional checkbox, danger styling) and `toast(message, kind)`
  (auto-dismissing bottom-center notices). The `UIFeedbackLayer` mounts
  inside the Workspace root at z-100/110 — above the Settings/wizard
  overlays, clipped by the window's rounded corners. Escape in the dialog
  uses capture-phase so overlays underneath don't also close; a second
  `confirm` cancels the first (dialogs never stack).

### Calendar modals

- [CalendarComposer.tsx](../../src/mainview/components/CalendarComposer.tsx)
  and `ScheduleDetail` ([CalendarPage.tsx](../../src/mainview/components/CalendarPage.tsx))
  now render as centered modals over the body pane (backdrop, `max-h-[85%]`,
  internal scroll) — long forms scroll inside the modal instead of running
  off the page.

### Confirmations → dialogs, results → toasts

Every inline confirm was replaced with the shared dialog + a result toast:

| Site | Confirm | Toast |
| --- | --- | --- |
| Cancel scheduled run (calendar) | new — was unconfirmed | "Schedule cancelled" |
| Save / Run-now (calendar detail) | n/a | "Schedule updated" / "Run started" |
| Schedule from composer | n/a | "Scheduled *form* for *date*" |
| Delete view (ViewsPage & ViewSettingsModal) | dialog | "View deleted" |
| Delete AI service (Settings) | dialog | "Service deleted" |
| Remove tool (Settings) | dialog, with "Also delete the copied executable" checkbox for custom installs | "Tool removed" |
| Delete form (FormsPanel) | dialog | "Form deleted" / error toast |
| Remove project (ProjectSettingsPage) | dialog | "Project removed" |
| Delete run (thread card ⋯ menu) | new — was unconfirmed | "Run deleted" |

Unsubmitted draft cards still dismiss without a confirm — nothing is
persisted yet, so a dialog would be pure friction.
