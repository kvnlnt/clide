# Ticket 19 — Views: Browser-Style Filter Tabs for the Thread

## Goal

Introduce **views** — named, saved filters over a project's thread — presented
as **browser-style tabs** at the top of the window inside the window-controls
header. A default tab shows all threads; a "+" button to the right of the tab
strip (exactly like a browser) creates a new view, which immediately prompts
the user to configure its filters.

## Background

- The header is [WindowControls.tsx](../src/mainview/components/WindowControls.tsx),
  rendered inside a drag-region `<header>` in
  [App.tsx](../src/mainview/App.tsx#L36-L38). Its middle section is currently a
  search/breadcrumb button — after ticket 21 that area is freed up and becomes
  the natural home for the tab strip.
- Thread content is derived in [useThread.ts](../src/mainview/hooks/useThread.ts):
  `visibleRuns` filters `runs` to the active project, then sorts (pinned first,
  reverse-chronological) and groups. A view is an **additional filter layer**
  applied inside `visibleRuns` before sorting/grouping.
- Per-project persistence precedent already exists: grid layouts are stored via
  `readLayout` / `writeLayout(projectPath, key, ...)`
  ([layout.ts](../src/bun/forms/layout.ts)) in `forms/.layouts/`. Views should
  follow the same per-project, on-disk pattern.
- Depends on **ticket 20** (removes the list/grid toggle from the thread
  header) and **ticket 21** (frees the header center from the form-search
  button). Land those first.

## Concept

A **view** is a named set of filters on the active project's runs:

```ts
interface ThreadView {
  id: string; // stable uuid
  name: string; // tab label, user-editable
  filters: {
    formSlugs?: string[]; // only runs of these forms
    statuses?: RunStatus[]; // e.g. running, success, error, scheduled
    pinnedOnly?: boolean;
    query?: string; // free-text match on form name/inputs
  };
}
```

Views are **per project**. The default "All" view is implicit — not persisted,
not deletable, no filters.

## Acceptance criteria

### 1. Tab strip in window controls

- The center section of [WindowControls.tsx](../src/mainview/components/WindowControls.tsx)
  renders a horizontal tab strip styled like browser tabs: rounded-top tabs,
  active tab visually raised/brighter (white text, subtle top+side border on
  `border-white/10`, matching the existing sidebar-corner treatment), inactive
  tabs muted (`text-white/30`, hover → white).
- First tab is always **All** — shows every thread for the active project
  (current behavior, no filters). It cannot be closed or renamed.
- User-created view tabs follow, in creation order, each with a small **×**
  close affordance (visible on hover, like a browser) that deletes the view
  (with the tab strip falling back to **All** if the active view is closed).
- A **+** button sits immediately to the right of the last tab (browser-style)
  and creates a new view.
- Tabs are clickable despite the header drag region — same pattern as the
  existing header buttons (buttons opt out of `electrobun-webkit-app-region-drag`).
- Overflow: if tabs exceed available width, they shrink with truncated labels
  (`title` shows full name); no horizontal scroll for v1.

### 2. New-view flow

- Clicking **+** creates a new tab (default name "View N"), activates it, and
  immediately opens a **filter editor** popover/panel anchored under the tab:
  - **Name** text input.
  - **Forms** multi-select of the active project's forms.
  - **Status** multi-select (idle / running / success / error / scheduled).
  - **Pinned only** toggle.
  - **Text query** input.
  - **Save** / **Cancel**. Cancel on a brand-new unsaved view removes the tab.
- Clicking the label of the already-active view tab re-opens the same editor to
  rename or adjust filters (browser-tab double-click-to-rename is out of scope;
  single-click-on-active is the edit gesture).
- Empty filter set is valid (behaves like All, but named).

### 3. Filtering

- The active view's filters are applied in
  [useThread.ts](../src/mainview/hooks/useThread.ts) inside `visibleRuns`,
  after the project filter and before sort/group. All existing behavior
  (pinned-first, date grouping, consecutive-run coalescing) applies to the
  filtered subset unchanged.
- Filters combine with AND across categories; multi-selects are OR within a
  category (e.g. status ∈ {error, running} AND slug ∈ selected forms).
- A view with no matching runs shows the existing empty state
  ([ThreadEmpty.tsx](../src/mainview/components/ThreadEmpty.tsx)) — ideally
  with copy indicating a filter is active ("No runs match this view").
- Switching projects switches to that project's views; active tab resets to
  **All** when the active project changes.

### 4. Persistence

- Views are stored per project on disk, following the layouts pattern:
  `<projectPath>/forms/.views.json` (or a sibling of `.layouts/`), via new
  `readViews(projectPath)` / `writeViews(projectPath, views)` in
  [src/bun/forms/](../src/bun/forms/) plus matching RPC endpoints in
  [types.ts](../src/shared/types.ts), [index.ts](../src/bun/index.ts), and
  [rpc.ts](../src/mainview/rpc.ts).
- Missing/corrupt file → empty view list (just **All**), no crash.
- Active-view selection is renderer state only (not persisted) for v1.

## State / API changes

- `AppContext` gains: `views: ThreadView[]`, `activeViewId: string | null`
  (`null` = All), `createView`, `updateView`, `deleteView`, `setActiveView`.
- New RPC pair `readViews` / `writeViews` mirroring `readLayout`/`writeLayout`.
- `ThreadView` type lives in [src/shared/types.ts](../src/shared/types.ts).

## Files to modify

- `src/mainview/components/WindowControls.tsx` — tab strip + "+" button.
- New `src/mainview/components/ViewTabs.tsx` + `ViewFilterEditor.tsx`.
- `src/mainview/context/AppContext.tsx` — view state, load-on-project-switch.
- `src/mainview/hooks/useThread.ts` — apply active view filters.
- `src/shared/types.ts`, `src/bun/index.ts`, `src/mainview/rpc.ts` — RPC.
- New `src/bun/forms/views.ts` (read/write, modeled on `layout.ts`).

## Edge cases

- Deleting a form referenced by a view's `formSlugs`: filter entry is simply
  inert (no matches); editor shows only currently-existing forms.
- Closing the active tab → activate **All**.
- No active project (`activeProject == null`): tab strip shows only **All**;
  "+" disabled.
- Two views may share a name; `id` is identity.
