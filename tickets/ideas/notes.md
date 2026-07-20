- No clear button for "new" badge. Also, badge maybe shouldn't be colored because it should jsut be the total "new" count. Also, the "new" badges on the result list should be in bold if unread, or at least should be something different than the normal badge once it's been read.
- There's no workflow examples in the Seeds. Need to add some for all the profiles.
- The Calendar view needs to see a list of all tasks/workflows that are recurring, else it's difficult to know what is going on. Also, the calendar should be able to pick/schedule a task or workflow.
- Deleting the occurrence of a task that is part of a recurring series should not automatically delete the entire series, but have an option to delete the series if desired. This is a common pattern in calendar apps and should be implemented here as well.
- When adding a file location, I'm unable to create a new folder which makes it cumbersome to add a new location. It would be nice to have a "create new folder" option in the file picker.
- The package managers are correctly detected. But there's no way to disable them or pick the preferred one. It would be nice to have a way to disable the ones you don't want to use, or pick the preferred one. Also, the sorting buttons on the right of the list is weird. I'd prefer it to be drag and drop.
- The files in the main apps settings don't show the project files. I'd like to see all files from this view. However I'd also like to keep the project files separate from the app files, so maybe a toggle to show/hide project files would be nice. Also, I want to make the app level files available to tasks and workflows in case a user wants to I/O outside of a project.
- I'd like compact mode to apply to the the project view tabs and toolbars as well as the toolbar tools (maybe only show their icon but provide a tooltip on hover). Also, the project view tabs should be full width and not have a max width.

AI Profile Interviews (ProfileInterviewPage, app + project scope)
Model picker — Let the user choose which model powers the interview.
Error recovery & cancel — An "Error: RPC request timed out." during an interview is a dead end with no retry, no cancel, and no way out short of force-quitting. Interviews need a cancel action and error states need recovery paths.
No natural ending — The app-scope interview never wraps up. Once the basics of the user's job duties are captured, offer an explicit "finish now or keep going" choice.
Draft review screen can't scroll — The "Here's the draft — every section is yours to edit before saving" step doesn't scroll.
Redundant restated question — Both app and project interviews ask "Last time you said '…' – still true?" which just parrots the first answer back. Fix the question logic, and show the category the current question belongs to.
First-Run Onboarding (FirstRunWelcome, FirstRunAIWizard)
Interview-first onboarding — Before "create your first project" and "set up your AI," interview the person. Detect whether they have an AI configured or have used the app before, ask what they want to do, and tailor the flow (e.g., a checklist of relevant ready-to-go workflows/tasks, and an explicit AI/no-AI path).
Tasks (TaskCardHeader, EllipsisMenu, TasksPanel)
Remove the task kebab menu — The EllipsisMenu on the task card header renders misaligned (offset down-right, looks detached). Remove it entirely and move its two options — Adopt Task and Version History — into the task's main edit form.
Header click shouldn't create a task — Clicking a task header in the task list should not open a new task; that screen is for managing existing tasks only.
Rename "forms" → "tasks" in code — AppContext.tsx still uses forms, formsBySlug, and the "forms" ProjectSurface value for what the UI calls tasks. Finish the rename.
Views (ViewsPage, ViewTabs)
Auto-delete empty views — Views with no filters applied should be removed automatically.
AI naming with manual override — Auto-name views with AI and re-name as contents change. Double-clicking a view tab opens a rename dialog; the name is also editable inline on the Views page. Once a user explicitly names a view, stop auto-naming it (inline rename stays available).
Calendar (CalendarPage)
Schedule tasks/workflows — The calendar should let you pick and schedule a task or workflow.
Files (FilesPage)
Files surface broken + off-theme — The virtual file system UI doesn't work, and its styling doesn't match the app theme.
Layout, Polish & UX
Compact density — The app is too spacious; tighten margins and offer compact variants of screens.
Full-width layout — App- and project-scope screens should use the full window width.
Smooth transitions / no FOUC — Eliminate flashes of unstyled content with initial loading states, a load-in animation, and animated screen transitions.
Signature animation & UX flair — Invest in distinctive animation/interaction polish that makes the product stand out.
Speech mode — Add a wave icon to the top-right app menu for a voice mode: speak commands to the app, have it speak back.
System & Transparency
Diagnostics screen — A screen showing app performance, memory usage, machine resources, and general health.
Transparency reveal — Store everything the app collects (activity, machine info, profile) in one location on disk, with a "Reveal" button that opens that folder.
Dev Environment
bun run dev:\* profile scripts broken — The seeded-profile dev scripts (dev:newbie, dev:beginner, dev:regular, dev:power, dev:edge) fail with a SQL error, likely in the seed:profile step.
Two notes: I split your first-run item (#6) out from the interview items because it's about onboarding flow, not the ProfileInterviewPage takeover — worth confirming that's the distinction you intend. And #16/#17 overlap; they could merge into one "motion design" ticket or stay split as bug-fix vs. aspirational.

- Picking model on interviews
- When interviewing I experienced a "Error: RPC request timed out." and no way to resolve it. Identifying dead ends like this is important. Also, being able to cancel actions is important. I had to force quit the app to get out of this state.
- The app interview goes on and on and never seems to "finish". After capture the basic tasks of their job duties, it would be nice to wrap it up and optionally provide them a way to finish or continue.
- On the interview "Here's the draft — every section is yours to edit before saving. Nothing is stored until you save." screen, scrolling doesn't work.
- File system doesn't work and it's theme doesn't match the app.
- The app is still too "spacious". It would be nice to tighten margins and give "compact" views of different screens.
- The app and project screen width should be full screen.
- Both app/project interviews ask this question "Okay, that's a great starting point. Last time you said 'manage video, audio, social media content creation and distribution' – still true?" and it doesn't make a lot of sense (it just restates teh first question). Show the "category" that the current question belongs to.
- "forms" are still called forms in the code. See the AppContext.tsx file.
- The task's kebab menu context menu is misaligned/detatched, showing up a good amount of pixels down and to the right of the icon making it look like it belongs to something else. It doesn't even need to exists, move it's options (Adopt Task and Version History) into the main edit form for the task.
- Click on a task header in the task list should NOT open up a new task, that's confusing. This screen is just for managing tasks, not creating new ones.
- The calendar should be able to pick/schedule a task or workflow.
- I think the top right app menu could use a little wave icon to represent a "speech mode" that would allow the user to speak commands to the app and have the app speak back.
- Automatically delete views that have no filters applied, no reason to keep them around.
- Automatically name views using ai and update it when things change like new events, etc... BUT if the user double clicks the view tab, open up a rename dialog so they can change it if they want. Also add the ability to change the name inline form the views page itself. If a user explicitly names a tab, no longer auto name it, but keep the ability to rename it inline.
- IN addition to the create your first project and setup your AI, interview the person first. Work in language that gives them an idea of where they're at. It could detect then if they have an AI setup, or have ever used the app before and adjust the flow accordingly. It could also ask them what they want to do with the app, and then tailor the experience to that such as a checklist of ready-to-go workflows and tasks that are relevant to their goals. The app could also ask them if they want to use the AI or not, and then tailor the experience accordingly.
- I want there to be a much more fancy animation and UX behavior that makes the product stand out more.
- There needs to be some way to diagnosing the machine, it's resources, how the app is doing etc. A "diagnostics" screen that shows the app's performance, memory usage, and other relevant information would be useful.
- The bun run dev:X aren't working, I'm getting a sql issue
- I want to add a "transparency" feature that shows all the information the app has collected on your activity, machine, profile etc...I want it to be kept in all the same place on the machine and I want a simple "reveal" button that opens up to the folder so the user can see everything.
- I get flash of unstyled content here and there. Just make all transitions smooth with animations and initial loading states. I want to see a nice animation when the app is loading, and when switching between screens.
