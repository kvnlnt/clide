# App Feedback — 2026-07-19

Sorted feedback from a review of the current app state. Not tickets yet — this is the source list to cut tickets from.

## AI Profile Interviews (`ProfileInterviewPage`, app + project scope)

1. **Model picker** — Let the user choose which model powers the interview.
2. **Error recovery & cancel** — An "Error: RPC request timed out." during an interview is a dead end with no retry, no cancel, and no way out short of force-quitting. Interviews need a cancel action and error states need recovery paths.
3. **Draft review screen can't scroll** — The "Here's the draft — every section is yours to edit before saving" step doesn't scroll.
4. **Redundant restated question** — Both app and project interviews ask "Last time you said '…' – still true?" which just parrots the first answer back. Fix the question logic, and show the category the current question belongs to.

## First-Run Onboarding (`FirstRunWelcome`, `FirstRunAIWizard`)

6. **Interview-first onboarding** — Before "create your first project" and "set up your AI," interview the person. Detect whether they have an AI configured or have used the app before, ask what they want to do, and tailor the flow (e.g., a checklist of relevant ready-to-go workflows/tasks, and an explicit AI/no-AI path).

## Tasks (`TaskCardHeader`, `EllipsisMenu`, `TasksPanel`)

7. **Remove the task kebab menu** — The `EllipsisMenu` on the task card header renders misaligned (offset down-right, looks detached). Remove it entirely and move its two options — Adopt Task and Version History — into the task's main edit form.
8. **Header click shouldn't create a task** — Clicking a task header in the task list should not open a new task; that screen is for managing existing tasks only.
9. **Rename "forms" → "tasks" in code** — `AppContext.tsx` still uses `forms`, `formsBySlug`, and the `"forms"` `ProjectSurface` value for what the UI calls tasks. Find anywhere else this failed to get updated in the previous ticket (96-rename-forms-to-tasks.md) and finish the renaming. I think this has affected the seeding, I'm seeing this error "SQLiteError: NOT NULL constraint failed: runs.form_slug" on `bun run dev:regular` and the other profiles.

## Views (`ViewsPage`, `ViewTabs`)

10. **Auto-delete empty views** — Views with no filters applied should be removed automatically.
11. **AI naming with manual override** — Auto-name views with AI and re-name as contents change. Double-clicking a view tab opens a rename dialog; the name is also editable inline on the Views page. Once a user explicitly names a view, stop auto-naming it (inline rename stays available).

## Calendar (`CalendarPage`)

12. **Schedule tasks/workflows** — The calendar should let you pick and schedule a task or workflow.

## Files (`FilesPage`)

13. **Files surface broken + off-theme** — The virtual file system UI doesn't work, and its styling doesn't match the app theme.

## Layout, Polish & UX

14. **Compact density** — The app is too spacious; tighten margins and offer compact variants of screens.
15. **Full-width layout** — App- and project-scope screens should use the full window width.
16. **Smooth transitions / no FOUC** — Eliminate flashes of unstyled content with initial loading states, a load-in animation, and animated screen transitions.
17. **Signature animation & UX flair** — Invest in distinctive animation/interaction polish that makes the product stand out.
18. **Speech mode** — Add a wave icon to the top-right app menu for a voice mode: speak commands to the app, have it speak back.

## System & Transparency

19. **Diagnostics screen** — A screen showing app performance, memory usage, machine resources, and general health.
20. **Transparency reveal** — Store everything the app collects (activity, machine info, profile) in one location on disk, with a "Reveal" button that opens that folder.

## Dev Environment

21. **`bun run dev:*` profile scripts broken** — The seeded-profile dev scripts (`dev:newbie`, `dev:beginner`, `dev:regular`, `dev:power`, `dev:edge`) fail with a SQL error (SQLiteError: NOT NULL constraint failed: runs.form_slug), likely in the `seed:profile` step.
