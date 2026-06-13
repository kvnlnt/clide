# Ticket 03 — Sidebar (Project Navigation)

## Goal
Build the left sidebar: a flat list of projects. Includes badge counts, user avatar, and footer controls.

## Acceptance criteria
- Sidebar shows all projects loaded from form metadata (distinct `project` values), sorted alphabetically
- The sidebar lists projects only — it does NOT nest or list the forms within each project
- Clicking a project selects it as the active project; its forms are surfaced in the main area (thread/grid), not in the sidebar
- Badge counts show the number of pending/running forms in that project (from run history)
- Active selection is visually highlighted (subtle rounded rectangle, as in Figma: `rgba(86,86,86,0.5)` radial gradient)
- Bottom of sidebar: user avatar (initials fallback), headset icon, ellipsis menu
- Sidebar width is fixed at 250px; no resize handle needed yet

## Visual spec (from Figma)
- Sidebar background: `#222121`, border-radius `5px`, `10px` inset from window edge
- Project name: bold 14px white (`font-bold`) when active, 60% white when inactive
- Chevron-right icon (18px) before each project name
- Badge: small filled circle (14.8px), colored (red for unread/error, green for success), number inside at 11px bold white, right-aligned in the row
- Selected row: `Rectangle 11` style — rounded pill highlight spanning sidebar width minus margins

## Component structure
```
Sidebar
  SidebarProject (repeating, clickable)
  SidebarFooter
    UserAvatar
    HeadsetIcon
    EllipsisMenu
```

## State
- `activeProjectId: string | null` — lifted to App-level context
- Badge counts derived from run history pushed from main process

## Files to create
- `src/mainview/components/Sidebar.tsx`
- `src/mainview/components/SidebarProject.tsx`
- `src/mainview/components/SidebarFooter.tsx`
- `src/mainview/context/AppContext.tsx` — activeProject, forms list, global state
