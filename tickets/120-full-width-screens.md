# Ticket 120 — App & Project Screens Use Full Window Width

## Goal

App-scope and project-scope screens should span the full window instead
of centering content in a capped column.

## Current behavior

Several pages constrain content with `max-w-[…]` wrappers, e.g.
[SettingsPanel.tsx](../src/mainview/components/SettingsPanel.tsx)
(`max-w-[640px] mx-auto`) and
[ProjectSettingsPage.tsx](../src/mainview/components/ProjectSettingsPage.tsx)
(`max-w-[560px]`); others found by `grep -rn "max-w-\[" src/mainview`.

## Acceptance criteria

- Page-level surfaces — Settings, Project Settings, Tasks, Views,
  Calendar, Files, workflow pages, first-run/interview takeovers — fill
  the window width (minus the sidebar where applicable), per the
  ticket 39 "full-width page" direction.
- Judgment allowed *within* a page: a 2000px-wide text input helps
  no one, so wide layouts should use the space (multi-column, wider
  tables) rather than just stretching single controls to absurdity.
  The **page** must not be a centered column; individual controls may
  still cap.
- Modals and popovers keep their intrinsic sizes — this is about pages.
- Check at both a small window and full-screen on a wide display.

## Files to modify

- The `max-w-[…]` wrappers across `src/mainview/components/`
  (SettingsPanel, ProjectSettingsPage, ProfileInterviewPage,
  FirstRunAIWizard, ThreadEmpty, workflow/NewWorkflowWizard, …)

## Notes

Sibling of ticket 119 (density) — land visual QA together.
