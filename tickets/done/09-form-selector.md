# Ticket 09 — Form Selector (Command Palette)

## Goal
Build the autocomplete form selector — the overlay that appears when the user clicks the command input in the top bar. It lets them search for and select a form to add to the top of the thread.

## Acceptance criteria
- Clicking the `✦ At your command...` input opens a centered overlay/popover
- User types to filter forms by name, description, project, or tags (fuzzy match)
- Results show: form name, project breadcrumb, description snippet
- Keyboard navigation: arrow keys move selection, Enter confirms, Escape dismisses
- Selecting a form: closes the overlay and adds the form as a new expanded FormCard at the top of the thread
- If no results match, an option "✦ Create new form..." appears at the bottom of the list (leads to ticket 10)
- Recent/pinned forms appear at the top of the list before the user types anything (last 5 used)

## Visual spec
- Overlay: centered in the content area, `#222121` bg, `1px solid #3d3c3c` border, `8px` border-radius, `480px` wide, max `400px` tall with scroll
- Search input inside the overlay: full-width, 14px, white, no border, `#141414` bg, top of overlay
- Result rows: 40px tall, form name 14px white, breadcrumb 12px `#575757`, hover: `rgba(255,255,255,0.05)` bg
- Active row: `rgba(86,86,86,0.3)` bg
- Backdrop: subtle dark scrim behind the overlay; clicking it dismisses
- No animation required (can add later)

## Filtering logic
- Case-insensitive substring match on: `meta.name`, `meta.description`, `meta.project`, `meta.tags`
- Results ranked: exact name match first, then starts-with, then contains, then tag/description matches
- Max 20 results shown

## Files to create
- `src/mainview/components/FormSelector.tsx` — the overlay component
- `src/mainview/components/FormSelectorRow.tsx` — individual result row
- `src/mainview/hooks/useFormSearch.ts` — filtering/ranking logic
