# Ticket 04 — Top Bar

## Goal
Build the top bar: breadcrumb showing active project/form, the form selector command input, and the view/filter control icons.

## Acceptance criteria
- Left side shows active breadcrumb: `Project › Form` at 16px, 50% white opacity
- Center: command input (form selector trigger) — shows placeholder `✦ At your command...` italic 30% white when empty
- Right side icons (left to right): Search, PanelLeft (sidebar toggle), List (view toggle), ListFilter, Ellipsis
- Clicking the command input opens the Form Selector overlay (ticket 09)
- Sidebar toggle (PanelLeft icon) collapses/expands the sidebar
- List icon toggles between thread view and grid view (ticket 12)
- Top bar height: 40px, full width of content area, no background fill (inherits `#141414`)
- A thin separator line divides the top bar from the thread area

## Visual spec (from Figma)
- Breadcrumb text: `font-normal`, 16px, `rgba(255,255,255,0.5)`
- Command input: flex-1, italic placeholder `✦ At your command...`, clicking it doesn't open a real `<input>` — it opens the Form Selector overlay as a modal/popover
- Icons: 20px, `rgba(255,255,255,0.6)`, hover: `rgba(255,255,255,1)` transition
- Ellipsis at far right: opens a context menu (stub for now)
- The top bar in the Figma also shows form-level controls (undo, open-external, ellipsis) when a form card is expanded — these belong to the FormCard component, not this bar

## Note on the command input
The command input is **not** a standard text input that submits on Enter. It is a trigger for the Form Selector autocomplete overlay (ticket 09). The visual treatment makes it look like a chat input bar but the behavior is: type → see matching forms → select one → form card appears at top of thread.

## Files to create/modify
- `src/mainview/components/TopBar.tsx`
- `src/mainview/context/AppContext.tsx` — add `sidebarOpen: boolean`, `viewMode: 'list' | 'grid'`
