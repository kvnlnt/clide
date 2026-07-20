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

## Implementation

Removed `mx-auto` (the actual centering mechanism) and widened the content
cap from SettingsPanel, ProjectSettingsPage, ProfileInterviewPage, and
NewWorkflowWizard/WorkflowEditor's body wrappers (640-860px → 820-1000px)
— "centered column" specifically means CSS-centered via `mx-auto`, so
dropping that while keeping a readable-width cap satisfies both "the page
must not be a centered column" and "a 2000px text input helps no one" at
once: content now starts at the page's natural edge like Tasks/Views/
Calendar do, using meaningfully more of a wide window, without individual
form fields stretching to the full viewport.

`FirstRunAIWizard.tsx` deliberately left centered — it's a first-run
hero/onboarding screen (radio-card provider choice, not a data list),
matching its sibling `FirstRunWelcome.tsx`'s same centered-hero
convention, which ticket 120 doesn't list for change. Widening or
left-aligning a one-time "First things first" screen would look
inconsistent with the welcome flow it chains from. `ThreadEmpty.tsx`'s
`max-w-[300px]` and `TasksPanel.tsx`'s inline edit card cap are
control-level text-wrap/card widths, not page bodies — left untouched
per the ticket's own "individual controls may still cap" carve-out.

Not verified live (no way to drive the running Electrobun app visually
from this environment) — the ticket's own "check at a small window and
full-screen on a wide display" step is worth doing manually.
