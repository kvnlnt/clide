# Ticket 12 — Grid View

## Goal
Add a customizable grid layout as an alternative to the thread list view, toggled from the top bar.

## Acceptance criteria
- Toggling the List icon in the top bar switches between list (thread) and grid view
- Grid view shows all forms available in the current project as cards in a responsive grid
- Each grid card shows: form name, last run status, last run time, quick-run button
- Clicking a grid card opens it as an expanded FormCard (same component as ticket 05) in a focused overlay or replaces the grid temporarily
- Grid layout is customizable: user can drag cards to reorder, resize (small / medium / large card sizes), and the layout is persisted per project in a `layout.json` file inside the project's metadata
- Pinned forms always appear in the first row of the grid
- Grid cards show the same status icons as collapsed list rows

## Visual spec
- Grid bg: same `#141414` as thread
- Card: `#222121` bg, `1px solid #3d3c3c` border, `5px` radius
- Card sizes: small (1 col, ~100px tall), medium (2 col, ~160px tall), large (fills row, ~240px tall)
- Card header: form name bold 14px white
- Card footer: status icon + last run time 12px 40% white + quick-run button (▶ icon)
- Drag handle: appears on hover at top-left corner

## Grid layout persistence
Layout stored at `~/.clide/forms/.layouts/<project-slug>.json`:
```json
{
  "cards": [
    { "formSlug": "create-media-post", "size": "medium", "position": 0 },
    { "formSlug": "create-article", "size": "small", "position": 1 }
  ]
}
```

## Files to create
- `src/mainview/components/GridView.tsx` — grid container
- `src/mainview/components/GridCard.tsx` — individual grid card
- `src/bun/forms/layout.ts` — read/write layout.json files
