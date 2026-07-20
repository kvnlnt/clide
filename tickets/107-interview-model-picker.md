# Ticket 107 — Interview Model Picker

## Goal

Let the user choose which AI service **and model** powers a profile
interview (app or project scope) before it starts, instead of the
interview silently using a default service.

## Current behavior

The interview engine ([interview.ts](../src/bun/ai/interview.ts)) takes an
`AIService` and calls `complete(service, …)`; the renderer never offers a
choice — [ProfileInterviewPage.tsx](../src/mainview/components/ProfileInterviewPage.tsx)
just starts asking.

## Acceptance criteria

- Before the first question, the interview shows a service + model
  selector, reusing the existing
  [ServiceModelPicker.tsx](../src/mainview/components/ServiceModelPicker.tsx)
  pattern from the task-creation wizard.
- Sensible default preselected (same default the wizard uses), so one
  click/Enter proceeds — choosing is optional, not a wall.
- The chosen service+model is used for every AI call in that session
  (questions, draft, self-critique) and passed through the interview RPCs
  in [index.ts](../src/bun/index.ts).
- Remember the last-used choice per scope (app vs. project) so repeat
  interviews default to it.

## Files to modify

- `src/mainview/components/ProfileInterviewPage.tsx`
- `src/mainview/components/ServiceModelPicker.tsx` (reuse; extract if needed)
- `src/bun/index.ts` (interview RPC signatures), `src/bun/ai/interview.ts`
