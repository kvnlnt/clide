# Ticket 100 — AI Profile Interview: App-Level User Profile

## Goal

CLIDE learns **who it's working for**. An AI-led interview — a short,
conversational chat — produces a structured **user profile**: who the user
is, their roles & responsibilities, what they're trying to accomplish with
the software, and what has historically frustrated them. The profile then
feeds every AI feature (magic fill, run summaries, wizard drafting) as
standing context, and **recursively improves itself**: each interview
critiques its own questions, and the app proposes profile updates from
observed usage.

This ticket builds the shared interview engine + the app-scoped profile;
ticket 101 reuses the engine for project-scoped profiles.

## Acceptance criteria

### 1. Profile model & storage

- `UserProfile` in [types.ts](../src/shared/types.ts): freeform-but-sectioned
  — `identity`, `roles`, `responsibilities`, `goals[]`, `frustrations[]`,
  plus `updatedAt`, `interviewCount`, and `selfNotes` (the AI's own
  accumulated interviewing notes, §4). Sections are plain text/markdown —
  human-readable, human-editable, no opaque blobs.
- Stored at the app scope: `dev.clide/profile.json` (alongside
  `projects.json`, [paths.ts](../src/bun/paths.ts)). RPC:
  `getUserProfile` / `saveUserProfile`.

### 2. Interview engine (shared)

- New `src/bun/ai/interview.ts`: a turn-based engine — given a **profile
  schema**, the **existing profile** (may be empty), and the AI's
  `selfNotes`, it generates the next question, ingests the answer, and
  ultimately emits a **profile draft diff** for user approval. Uses the
  default AI service ([aiServices.ts](../src/bun/ai/aiServices.ts));
  scope-agnostic so ticket 101 can pass a project schema.
- Interview behavior: 5–8 questions max per session, one at a time,
  conversational not form-like; when a profile already exists it asks
  **delta questions** ("Last time you said X — still true?") instead of
  restarting; the user can skip any question or end early and still get a
  draft from what was gathered.

### 3. UI

- Full-window takeover surface (ticket 67/76 conventions):
  `ProfileInterviewPage.tsx` — chat transcript, one active question,
  text answer box, Skip / Finish controls; ends on a **review screen**
  showing the drafted profile as editable sections with an explicit Save.
- Entry points: a **Profile** section in
  [SettingsPanel.tsx](../src/mainview/components/SettingsPanel.tsx)
  (view/edit the raw profile, "Re-interview me" button, delete profile) and
  a gentle one-time prompt after first-run setup completes (ticket 76/78
  chain) — offered, never forced.

### 4. Recursive self-improvement

- **Interview critiques itself**: after each session the engine makes one
  additional AI call — "given this transcript, which questions earned
  nothing, what should be asked differently next time?" — and stores the
  result in `selfNotes`, which seeds the _next_ interview's question
  generation. The question set is thus data, not code.
- **Learns from usage**: a reflection pass (manual "Refresh from my
  activity" button in Settings; optionally on a long-interval schedule)
  feeds recent run history summaries + task/tool usage patterns to the AI
  and proposes profile amendments ("You run backup tasks weekly — add
  reliability to goals?"). Amendments are **always a reviewed diff** the
  user accepts or rejects — the profile never silently rewrites itself.
- Rejected amendments are also recorded in `selfNotes` so the same bad
  suggestion isn't re-proposed.

### 5. Consumption

- A `profileContext()` helper renders the profile into a compact system-
  prompt block; wire it into [magicFill.ts](../src/bun/ai/magicFill.ts),
  run summaries (ticket 98 — skip that call site until 98 lands), and the
  task/workflow wizard drafting calls
  ([workflowDraft.ts](../src/bun/ai/workflowDraft.ts), formGenerator —
  `taskGenerator` after ticket 96). Each call site caps the injected block
  so the profile can't crowd out the actual task.

## Files to modify

- New: `src/bun/ai/interview.ts`, `src/bun/profile.ts` (read/write),
  `src/mainview/components/ProfileInterviewPage.tsx`
- `src/shared/types.ts`, `src/bun/index.ts` (RPC),
  `src/mainview/components/SettingsPanel.tsx`,
  `src/mainview/context/AppContext.tsx`, AI call sites listed in §5

## Edge cases

- No AI service configured: Profile section explains and links to AI
  Services; interview entry points hidden until a service exists.
- The user's answers may contain sensitive material — the profile is
  local-only, sent solely within the user's own AI calls; say so in the UI.
- Mid-interview abort (window close): transcript discarded, profile
  untouched.
- A profile that's pure noise (user skipped everything): don't save an
  empty shell; keep "no profile yet" state.

## Note

Vocabulary per ticket 96 ("task"). Ticket 101 depends on this engine.
