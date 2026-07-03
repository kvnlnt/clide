# Ticket 31 — Forms Surfaces as Page Content

## Goal

Ticket 26 made Forms a closeable panel *tab*, but its content still looks like
a modal: [FormsPanel.tsx](../src/mainview/components/FormsPanel.tsx) renders a
floating 560px bordered card centered in the pane, and the new-form creator
([NewFormModal.tsx](../src/mainview/components/NewFormModal.tsx)) is a true
overlay with a black backdrop (`absolute inset-0 bg-black/50`). Both should
read as **normal page content of their tab**, consistent with how the thread
fills its pane.

## Acceptance criteria

### 1. Forms panel (browse forms)

- The content sits directly on the tab's background (`bg-clide-bg`) — no
  floating panel card, border, or card shadow wrapping the whole surface.
- A reasonable reading width is fine (e.g. a centered `max-w-*` column like a
  settings page), but it should feel like a page, not a dialog: full-height,
  search input and results flowing in the pane.
- The header's own × close button can go — the tab already has its × (keep
  Escape-to-close behavior).
- Search, keyboard navigation (↑/↓/Enter), edit, and delete flows are
  unchanged.

### 2. New form creator

- `NewFormModal` loses the backdrop overlay and renders as page content in
  the same pane (it is reached from the Forms tab / ⌘P flow, so it can render
  within the forms tab's body, replacing the search list while active).
- Rename to match (`NewFormPage` or similar) — it's no longer a modal.
- Cancel/Escape returns to the forms list; successful creation behaves as
  today (draft added to thread, panel closed).
- The multi-step spec-first flow (ticket 22) is unchanged — only the shell
  around it changes.

### 3. Consistency check

- Settings and Project Settings tabs already render as panes — align spacing
  and max-width with whatever pattern this ticket establishes so all panel
  tabs feel like the same family.

## Files to modify

- `src/mainview/components/FormsPanel.tsx`
- `src/mainview/components/NewFormModal.tsx` (rename)
- `src/mainview/App.tsx` (render creator as tab content instead of overlay)
- Possibly `src/mainview/context/AppContext.tsx` if `newFormOpen` state moves
  under the forms panel

## Edge cases

- ⌘P with no project active still opens the Forms tab scoped to all projects.
- Closing the Forms tab while the creator is open should discard the creator
  state cleanly.
- `NewProjectModal` (welcome-screen flow) is out of scope — it is a genuine
  modal over the welcome screen.
