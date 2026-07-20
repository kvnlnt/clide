# Ticket 110 — Interview Question Logic: No Redundant Restatement + Show Category

## Goal

Both app and project interviews open with a question like: "Okay, that's a
great starting point. Last time you said 'manage video, audio, social
media content creation and distribution' – still true?" — which just
parrots the user's own first answer back at them. Fix the question logic,
and show the user which **category** the current question belongs to so
the interview feels like it's going somewhere.

## Acceptance criteria

### 1. No parroting

- The engine ([interview.ts](../src/bun/ai/interview.ts)) must not ask the
  user to re-confirm something they just said in this session, and a
  re-confirmation of a *previous* session's answer must add value (ask
  about changes/specifics, not a verbatim "still true?" echo).
- Fix via the system prompts and/or the transcript context passed to the
  model; add an explicit instruction that each question must seek **new**
  information not already in the transcript or stored profile.

### 2. Question categories

- Each question carries a category (e.g. Role, Goals, Tools, Frustrations
  — whatever taxonomy the prompts already imply). The model returns it as
  part of the structured next-question payload; the engine validates it
  against a fixed list.
- [ProfileInterviewPage.tsx](../src/mainview/components/ProfileInterviewPage.tsx)
  displays the category above the current question (small label, 40%
  white per the visual language), so identical-sounding questions read as
  belonging to different sections.

## Files to modify

- `src/bun/ai/interview.ts` (prompts, payload shape, category validation)
- `src/mainview/components/ProfileInterviewPage.tsx`
- `src/shared/types.ts` if the question payload type lives there
