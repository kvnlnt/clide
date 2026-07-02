# Ticket 21 — Settings in Header + Rework Form Search into a Real Forms CRUD Flow

## Goal

Three related header/flow changes:

1. **Move the settings button** from the sidebar footer to the window-controls
   header (right-side cluster, next to the sidebar toggle).
2. **Remove the header click-to-search.** The header's center button (search
   icon + project name) currently opens the FormSelector overlay — kill that
   gesture. The header center becomes plain, non-interactive branding/project
   text (and, per ticket 19, will host the view tabs).
3. **Re-envision forms as a proper CRUD flow.** Finding, creating, editing, and
   deleting forms should live in one coherent place instead of being split
   across a hidden command palette, thread drafts, and Project Settings.

## Background

### Settings button today

- Sidebar footer ([SidebarFooter.tsx](../src/mainview/components/SidebarFooter.tsx#L24-L26))
  has an `Ellipsis` button calling `openSettings` from
  [AppContext.tsx](../src/mainview/context/AppContext.tsx#L161); the panel is
  [SettingsPanel.tsx](../src/mainview/components/SettingsPanel.tsx), rendered
  from [App.tsx](../src/mainview/App.tsx#L43).
- Problem: if the sidebar is collapsed, settings are unreachable.

### Header search today

- [WindowControls.tsx](../src/mainview/components/WindowControls.tsx#L23-L29):
  center button (`Search` icon + `activeProject ?? "CLIDE"`) calls
  `openSelector`, opening [FormSelector.tsx](../src/mainview/components/FormSelector.tsx)
  — a command palette (fuzzy search via
  [useFormSearch.ts](../src/mainview/hooks/useFormSearch.ts), recents, and a
  trailing "Create new form" row that spawns a
  [NewFormCard.tsx](../src/mainview/components/NewFormCard.tsx) draft in the
  thread). `⌘P` also opens it ([App.tsx](../src/mainview/App.tsx#L24-L28)).

### Forms CRUD today (scattered)

- **Create**: FormSelector's "Create new form" → `addNewFormDraft` → AI-powered
  NewFormCard in the thread.
- **Read/search**: FormSelector palette only.
- **Update**: no UI (files on disk only).
- **Delete**: Forms tab of Project Settings
  ([ProjectFormsManager.tsx](../src/mainview/components/ProjectFormsManager.tsx),
  `deleteForm` in [AppContext.tsx](../src/mainview/context/AppContext.tsx#L47)).
- Sidebar ([Sidebar.tsx](../src/mainview/components/Sidebar.tsx) /
  [SidebarProject.tsx](../src/mainview/components/SidebarProject.tsx)) already
  lists each project's forms — the natural anchor for a unified flow.

## Acceptance criteria

### 1. Settings button in window controls

- [WindowControls.tsx](../src/mainview/components/WindowControls.tsx) right
  cluster gains a settings button (Lucide `Settings` — clearer than the current
  `Ellipsis` at header scale) calling `openSettings`, placed beside the
  `PanelLeft` sidebar toggle with matching styling
  (`text-white/30 hover:text-white`, `size={18}`, `title="Settings"`).
- The `Ellipsis`/`openSettings` button is removed from
  [SidebarFooter.tsx](../src/mainview/components/SidebarFooter.tsx) (keep the
  CL avatar and the add-project `Plus`).
- Settings reachable with the sidebar collapsed.

### 2. Remove header click-to-search

- The center `openSelector` button in WindowControls becomes a
  non-interactive element: project name (or "CLIDE") only — no `Search` icon,
  no click handler, no hover affordance. It remains part of the drag region.
- Decide `⌘P`'s fate together with §3: it should open the new forms flow
  (repointed, not silently dropped).

### 3. Unified forms CRUD flow

Replace the palette-as-front-door with an explicit, discoverable flow. Proposed
shape (adjust during implementation, but keep the invariants below):

- **Forms drawer/panel** — a single "Forms" surface for the active project,
  opened from an affordance in the sidebar project header and by `⌘P`. It
  contains:
  - **Search/filter** input reusing
    [useFormSearch.ts](../src/mainview/hooks/useFormSearch.ts) (fuzzy match +
    recents ordering preserved).
  - **List** of the project's forms: name, description, tags.
  - Per-form actions: **Run** (adds a form draft to the thread — today's
    `addFormDraft`), **Edit**, **Delete** (confirm + `deleteForm`, reusing the
    guard rails from ProjectFormsManager).
  - **New form** button → existing AI-powered NewFormCard draft flow
    (`addNewFormDraft`), unchanged under the hood.
- **Edit** (new capability, minimum viable): edit `meta.json` fields — name,
  description, tags — via a small form. Requires a new `updateFormMeta`
  RPC (shared/types.ts, bun/index.ts handler writing via
  [writer.ts](../src/bun/forms/writer.ts)-adjacent code, rpc.ts). Editing
  fields/script stays out of scope (files on disk remain the escape hatch —
  note this in the UI copy or a tooltip).
- **Delete** and **list** duplicate what ProjectFormsManager's Forms tab does:
  fold that tab's contents into the new surface and remove it from Project
  Settings (single source of truth), or keep Project Settings as a thin link
  that opens the Forms drawer — pick one, don't maintain two lists.
- FormSelector's overlay (as a modal command palette) is retired:
  [FormSelector.tsx](../src/mainview/components/FormSelector.tsx) /
  [FormSelectorRow.tsx](../src/mainview/components/FormSelectorRow.tsx) are
  removed from the render path (delete or repurpose their row rendering inside
  the new panel), and `selectorOpen`/`openSelector`/`closeSelector` in
  AppContext are replaced by the new panel's open/close state.

### Invariants

- Everything you could do before is still possible: fuzzy-find a form and add
  it to the thread, create a new form via AI, delete a form.
- Keyboard path preserved: `⌘P` opens the forms surface with search focused;
  arrow/Enter selection still works in the list.
- `bunx tsc --noEmit` and `bunx vite build` pass.

## Files to modify

- `src/mainview/components/WindowControls.tsx` — add settings button; neuter
  center button.
- `src/mainview/components/SidebarFooter.tsx` — drop settings button.
- `src/mainview/components/FormSelector.tsx` / `FormSelectorRow.tsx` — retire
  or fold into new panel.
- New `src/mainview/components/FormsPanel.tsx` (name TBD).
- `src/mainview/components/Sidebar.tsx` / `SidebarProject.tsx` — entry point.
- `src/mainview/context/AppContext.tsx` — selector state → forms-panel state;
  `updateFormMeta` wiring.
- `src/mainview/App.tsx` — render new panel; repoint `⌘P`.
- `src/shared/types.ts`, `src/bun/index.ts`, `src/mainview/rpc.ts`,
  `src/bun/forms/` — `updateFormMeta` RPC.
- `src/mainview/components/ProjectFormsManager.tsx` /
  `ProjectSettingsModal.tsx` — deduplicate forms management.

## Edge cases

- No active project: forms panel shows all forms (current FormSelector
  behavior when `activeProject` is null) or prompts to pick a project — choose
  one and make it deliberate.
- Deleting a form with runs in the thread: existing `deleteForm` semantics
  apply (runs whose form is gone already render as missing-folder no-ops in
  [Thread.tsx](../src/mainview/components/Thread.tsx)); confirm copy should
  warn history cards will lose their form.
- Renaming a form must not change its `slug` (slug is identity across
  runs/history); only display metadata changes.

## Dependencies / sequencing

- Coordinates with **ticket 19** (view tabs land in the header center this
  ticket vacates). Do this ticket first or together.
