# Ticket 39 — Forms, Settings & Views as Full-Fledged Pages

## Goal

The project tab's surfaces don't read as pages:

- **Forms** ([FormsPanel.tsx](../src/mainview/components/FormsPanel.tsx)) is a
  centered `max-w-[640px]` column — looks like an orphaned form floating in
  the pane.
- **Project Settings**
  ([ProjectSettingsModal.tsx](../src/mainview/components/ProjectSettingsModal.tsx))
  is still a `w-[560px]` bordered card with modal chrome (× header,
  Cancel/Save footer) — looks like a modal that lost its backdrop.
- **Views** isn't a surface at all — just the "Hidden (N)" popover on
  [ProjectToolbar.tsx](../src/mainview/components/ProjectToolbar.tsx).

Make all three real pages: full-width, edge-to-edge under the project toolbar,
with one consistent, elegant page design.

## Acceptance criteria

### 1. Shared page language

All three surfaces share the same skeleton (follow the app-settings page from
ticket 33 as the reference):

- Full-width page header block: large title, muted subtitle (e.g. the project
  name), pinned while the body scrolls.
- Body fills the pane width edge-to-edge. Wide layouts may cap *line length*
  for readability, but the page surface itself — headers, rules, row hover
  states, list rows — spans the full width so nothing floats as an island.
- No card borders around the whole page, no modal-style ×-and-footer chrome.
  Leaving a surface = clicking its toolbar button again or another toolbar
  destination (per ticket 34 semantics).

### 2. Forms page

- Rework `FormsPanel` into a full-width page: header ("Forms" + project
  name), the search input and results list spanning the width — result rows
  become full-width rows with columns (name, description, tags, actions)
  instead of a narrow stacked column.
- Existing behavior is preserved: fuzzy search, keyboard navigation
  (↑/↓/Enter), run-on-select, inline meta editing, delete confirmation,
  "Create new form" entry, Escape-to-thread.

### 3. Project Settings page

- Rework `ProjectSettingsModal` into `ProjectSettingsPage`: page header
  ("Settings" + project name), full-width sections — Name, Folder (with
  Reveal), Danger zone — in the shared page style. Save stays a page-level
  action (button after the fields; Enter still saves the name).
- Drop the modal header ×, the Cancel footer, and the card border. Delete
  confirmation stays inline in the danger section.

### 4. Views page (new)

- Add `"views"` to `ProjectSurface` in
  [AppContext.tsx](../src/mainview/context/AppContext.tsx) and a **Views**
  button on the project toolbar (between Forms and Settings).
- The page lists **all** saved views for the project — visible and hidden —
  as full-width rows: name, a compact filter summary (forms / statuses /
  keywords counts), and actions: **open** (activates the tab), **hide/show**
  toggle, **delete** (with inline confirm).
- The "Hidden (N)" popover on the project toolbar is removed — unhiding lives
  here now.
- Row order matches tab order; keep drag-to-reorder in the tab strip as the
  reorder mechanism (a reorder affordance on this page is optional, not
  required).

## Files to modify

- `src/mainview/components/FormsPanel.tsx`
- `src/mainview/components/ProjectSettingsModal.tsx` → `ProjectSettingsPage.tsx`
- `src/mainview/components/ViewsPage.tsx` (new)
- `src/mainview/components/ProjectToolbar.tsx`
- `src/mainview/context/AppContext.tsx`, `src/mainview/App.tsx`

## Edge cases

- Deleting the project from the settings page while its page is open must
  land somewhere sane (welcome screen — `activeProject` already resets).
- Views page with zero saved views: an inviting empty state pointing at the
  "+" tab button.
- Opening a hidden view from the Views page unhides it and activates its tab
  (same semantics the popover has today).
- Renaming the project updates the page header without a stale name flash
  (`activeProject` follows the rename via existing context logic).
