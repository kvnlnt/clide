# Ticket 101 — AI Profile Interview: Per-Project Profiles

Depends on ticket 100 (interview engine, self-improvement loop, review-diff
pattern — all reused, not rebuilt).

## Goal

Each **project** gets its own AI-interviewed profile: what this project is
for, the user's role and responsibilities _within it_, its goals, and the
historical frustrations it exists to relieve. Project-scoped AI features
(magic fill, run summaries, wizard drafting inside that project) get both
the app profile **and** the project profile as context. Same recursive
self-improvement contract as ticket 100.

## Acceptance criteria

### 1. Model & storage

- `ProjectProfile` mirrors `UserProfile`'s shape with project-slanted
  sections: `purpose`, `userRole`, `responsibilities`, `goals[]`,
  `frustrations[]`, `updatedAt`, `interviewCount`, `selfNotes`.
- Stored **in the project folder** — `<projectPath>/profile.json` — so it
  travels with the folder like forms/, history.db, and `.views.json`
  ([paths.ts](../src/bun/paths.ts) per-project helpers). RPC:
  `getProjectProfile(projectPath)` / `saveProjectProfile`.

### 2. Interview

- The ticket-100 engine runs with a project schema and **both existing
  profiles** as context: it must not re-ask what the app profile already
  answers (who you are) — it asks what's specific here ("What is
  <Project> for?", "What does 'done' look like?", "What kept going wrong
  before you built this?").
- Same UX surface (`ProfileInterviewPage` parameterized by scope), same
  5–8 question cap, delta-question behavior on re-interview, and editable
  review-then-save screen.

### 3. Entry points

- [ProjectSettingsPage.tsx](../src/mainview/components/ProjectSettingsPage.tsx)
  gains a **Profile** section: current profile summary (or empty state),
  "Interview me about this project", edit raw sections, delete.
- New-project flow: after creating a project
  ([NewProjectModal.tsx](../src/mainview/components/NewProjectModal.tsx)
  success path), offer a dismissible "Tell CLIDE about this project"
  prompt — offered once, never forced, never blocks getting to the thread.

### 4. Recursive self-improvement (scoped)

- Per-project `selfNotes` accumulate exactly as in ticket 100 §4 — the
  post-session critique and rejected-amendment memory are **per project**.
- "Refresh from activity" reflects over **this project's** run history and
  task usage only, proposing reviewed diffs to the project profile.
- Cross-pollination, one direction only: a project reflection may also
  surface an app-profile suggestion ("this is the third project about
  publishing — add it to your goals?") routed through the ticket-100
  review flow. App reflections never edit project profiles.

### 5. Consumption

- `profileContext()` (ticket 100) gains a project parameter: AI calls that
  execute with a project in hand (magic fill for that project's tasks, run
  summaries, task/workflow wizard drafts) receive app + project blocks,
  project last so it wins on conflict. Combined block stays capped.

## Files to modify

- `src/bun/ai/interview.ts` (project schema), new `src/bun/projectProfile.ts`
- `src/shared/types.ts`, `src/bun/index.ts` (RPC),
  `src/mainview/components/ProfileInterviewPage.tsx` (scope param),
  `ProjectSettingsPage.tsx`, `NewProjectModal.tsx`,
  `src/mainview/context/AppContext.tsx`, `profileContext` call sites

## Edge cases

- Project folders are user-visible on disk — `profile.json` may be edited
  or deleted externally; loader treats corrupt/missing as "no profile"
  (same resilience as `.views.json`).
- Renaming a project doesn't touch the profile (it lives in the folder);
  registering an existing folder that already contains a `profile.json`
  adopts it as-is.
- No app profile yet: project interview still works — it just can't skip
  identity questions, so it asks a compressed one and suggests the app
  interview at the end.
- Seeded dev-profile projects ([seed-profile.ts](../scripts/seed-profile.ts))
  may ship canned profiles so `dev:hmr:<profile>` personas exercise the
  context injection.
