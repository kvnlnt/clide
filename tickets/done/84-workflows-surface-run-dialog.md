# Ticket 84 — Workflows Surface, Reworked Run Dialog & Menu Entry

Part of the Workflow epic (79-86). Depends on 79 (CRUD); the list page's Run
button needs 80/81.

## Goal

Navigation and entry points: a **Workflows** button on the project toolbar
with a list page; the ⌘K **Run dialog re-envisioned** to search forms *and*
workflows with clear visual distinction, distinct create buttons, and a
better overall layout; and Workflows added to the native **View menu**.

## Acceptance criteria

### 1. Workflows surface

- `"workflows"` joins `ProjectSurface`
  ([AppContext.tsx](../src/mainview/context/AppContext.tsx)); a Workflows
  button (Lucide `Route` or `ListChecks`) on
  [ProjectToolbar.tsx](../src/mainview/components/ProjectToolbar.tsx)
  between Views and Tools' old spot, toggling like its siblings.
- The page (full-width, ticket-39 conventions) lists the project's
  workflows: name, description, enabled toggle, trigger summary ("manual ·
  daily 9:00 · on Fetch RSS"), last-run status/time, actions — **Run**,
  Edit (ticket 82), Runs (ticket 85), Delete (ticket-74 confirm dialog +
  toast). Empty state points at "New workflow" (ticket 83 wizard).

### 2. Run dialog rework ([RunFormPicker.tsx](../src/mainview/components/RunFormPicker.tsx))

- One search field over **both forms and workflows** (extend
  `useFormSearch` or generalize it); results grouped under labeled section
  headers ("Forms", "Workflows") with per-row type distinction that
  survives mixed keyboard navigation — icon + subtle badge, not color
  alone.
- Choosing a form drops a draft card (unchanged); choosing a workflow
  starts a manual run (params prompt per ticket 81) and links to its live
  trace.
- **Two distinct create actions** — "New form…" and "New workflow…" — as
  clearly separated footer buttons (not look-alike list rows blended into
  results; the current single italic row pattern retires).
- General layout pass while in here: search field first (top), results in
  the middle, create actions in a footer bar; consistent paddings; keyboard
  nav (↑↓/Enter) spans sections in visual order. Stays a `Modal`
  (ticket 75).

### 3. Menus & shortcuts

- Native **View menu** (ticket 73) gains "Workflows" with an accelerator;
  the in-app shortcut and toolbar tooltip match. Suggest **⌘⇧U**
  (⌘⇧W reads as "close all windows" on macOS — avoid); wire through the
  existing `dispatchViewAction` path with the same toggle + dedupe
  behavior.

## Files to modify

- `src/mainview/components/ProjectToolbar.tsx`, `App.tsx` (surface render,
  shortcut, menu action id), `src/bun/index.ts` (View menu item)
- New: `src/mainview/components/workflow/WorkflowsPage.tsx`
- `src/mainview/components/RunFormPicker.tsx` (rename to `RunPicker.tsx`),
  `src/mainview/hooks/useFormSearch.ts`
- `src/mainview/context/AppContext.tsx`

## Edge cases

- ⌘K with zero workflows: no empty "Workflows" section header — forms-only
  layout looks like today's.
- A disabled workflow appears in the picker but its Run action explains
  it's disabled (enable from the list page) rather than silently failing.
- FormsPanel's existing "Create new form" row keeps working; only the run
  dialog's creation affordances are redesigned here.

## Note

Do the dialog rename (`RunPicker`) in this ticket so later tickets aren't
importing a misnomer.
