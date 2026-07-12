# Ticket 75 — Escape Always Closes Modals (Shared Modal Component)

*(Documented alongside implementation.)*

## Bug & goal

The calendar's schedule editor didn't close on Escape. Root cause: several
modals handled Escape with `onKeyDown` on their backdrop div, which only
fires when focus is *inside* the modal — with nothing focused, Escape lands
on `body` and dies. Escape must always close a modal, and the guarantee must
be structural so future modals can't regress it.

## What was done

- New [Modal.tsx](../../src/mainview/components/Modal.tsx):
  - `useEscapeToClose(onClose, enabled?)` — a **window-level** keydown
    listener, so Escape works regardless of focus;
  - `Modal` — THE modal pattern: dimmed backdrop, centered panel, Escape
    closes, backdrop click closes, inside clicks don't. **New modals must
    wrap their content in this** instead of hand-rolling a backdrop.
- Converted every modal to `Modal`: ScheduleDetail (the reported bug),
  CalendarComposer, NewProjectModal, ViewSettingsModal, RunFormPicker —
  deleting their per-modal Escape code (including redundant input-level
  handlers).
- Full-window overlays use the hook: the wizard (NewFormPage) swapped its
  focus-dependent root `onKeyDown` for `useEscapeToClose`; SettingsPanel's
  bespoke listener became `useEscapeToClose(onClose, !editing)`.
- Layering: the confirm dialog (UIFeedback) keeps its capture-phase
  listener + `stopPropagation`, so Escape with a dialog stacked over a
  modal closes only the dialog.
- Local-Escape semantics preserved deliberately: the wizard's field-label
  input collapses its card on Escape and now **stops propagation** so it no
  longer also closed the wizard (pre-existing bug); FormsPanel search-clear,
  ProjectSettingsPage name-reset, and PortalPopover close are page/popover
  semantics, not modals, and stay as they are.
