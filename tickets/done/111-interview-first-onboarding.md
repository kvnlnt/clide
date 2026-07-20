# Ticket 111 — Interview-First Onboarding

## Goal

Before "create your first project"
([FirstRunWelcome.tsx](../src/mainview/components/FirstRunWelcome.tsx))
and "set up your AI"
([FirstRunAIWizard.tsx](../src/mainview/components/FirstRunAIWizard.tsx)),
interview the person. First-run should open by learning who the user is
and what they want, then tailor the rest of the flow — in language that
tells them where they are in the process.

## Acceptance criteria

### 1. Detection first

- On launch, detect the user's state: AI service configured? Any projects?
  Any prior app profile ([profile.ts](../src/bun/profile.ts))? Adjust the
  flow accordingly — a returning user with an AI configured skips setup
  steps; a true first-run gets the full sequence.

### 2. Onboarding interview

- A lightweight opening interview (reuse the ticket 100 engine in
  [interview.ts](../src/bun/ai/interview.ts)) asks what they want to do
  with the app. (Amended: AI is a requirement, not a choice — the flow
  never asks whether to use it.)
- The flow communicates progress/position ("step X of Y" or equivalent
  language) so the user knows where they're at.

### 3. Tailored outcome

- Answers drive what comes next; the flow always ends in the AI wizard
  unless a service is already configured. (Amended: AI is a requirement —
  there is no no-AI path.)
- After setup, present a goal-relevant starting point — e.g. a checklist
  of ready-to-go workflows/tasks matched to what they said they want to
  do, seeded into their first project.
- The interview's answers land in the app profile so ticket 100's
  self-improving loop benefits.

## Files to modify

- `src/mainview/components/FirstRunWelcome.tsx`, `FirstRunAIWizard.tsx`,
  `ProfileInterviewPage.tsx` (or a new onboarding takeover component)
- `src/mainview/context/AppContext.tsx` (first-run orchestration)
- `src/bun/profile.ts`, `src/bun/ai/interview.ts`, `src/bun/index.ts`

## Notes

- Depends on ticket 108 (error recovery) — an onboarding interview that
  can dead-end on first launch is worse than none.
- `bun run dev:newbie` is the test persona for the zero-state path.
