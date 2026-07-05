# Ticket 36 — Compact View Toolbar Controls

## Goal

The view toolbar (ticket 35, [ViewToolbar.tsx](../src/mainview/components/ViewToolbar.tsx))
spreads its filters across the full row: form chips inline, five always-visible
status chips, a bare text input. Compact all three into the same pattern — a
**collapsed dropdown trigger that shows only a summary**, expanding to a
popover with the full multiselect controls. Nothing but small, same-height
trigger buttons should sit in the toolbar itself.

## Acceptance criteria

### 1. Shared multiselect dropdown primitive

- One reusable component (e.g. `MultiSelectDropdown.tsx`) built on
  [PortalPopover.tsx](../src/mainview/components/PortalPopover.tsx):
  - **Collapsed trigger**: compact button showing a label summary and a caret;
    visually indicates when the filter is active (≥1 selection) vs. inert.
  - **Expanded popover**: the current selections listed with remove (×)
    controls, plus the means to add more. Outside click / Escape closes.
- All three toolbar filters below consume it so they look and behave
  identically.

### 2. Forms filter → multiselect dropdown with autocomplete

- Collapsed: `All forms` when nothing selected; `N forms` (`1 form`) when
  selected — no chips in the toolbar row anymore.
- Expanded: selected forms as removable rows/chips, an autocomplete input
  (reuse the existing suggestion logic — live-filtered, capped, Enter picks
  the first match) to add more.
- Selection changes apply to the view immediately (existing `updateView`
  live-apply path).

### 3. Status filter → multiselect dropdown

- Collapsed: `Any status` when none selected; `N statuses` (`1 status`) when
  selected.
- Expanded: the five statuses as toggleable checkbox rows.
- Live-apply, same as forms.

### 4. Keyword filter → multi-keyword dropdown with AND/OR

- Collapsed: `Keywords` (inert) when none; `N keywords` when set.
- Expanded: current keywords as removable chips, a text input where Enter
  adds a keyword, and an **AND / OR** toggle choosing whether a run must match
  all keywords or any of them.
- **Data model** ([types.ts](../src/shared/types.ts) `ThreadViewFilters`):
  replace `query?: string` with `keywords?: string[]` and
  `keywordMode?: "and" | "or"` (default `"or"`).
- **Matching** ([useThread.ts](../src/mainview/hooks/useThread.ts)
  `matchesView`): each keyword matches the way `query` does today (form name
  or serialized inputs, case-insensitive); combine per `keywordMode`.
- **Migration**: `.views.json` files persisted with the old `query` string
  load as `keywords: [query]` — no data loss, no crash on old files.

## Files to modify

- `src/mainview/components/MultiSelectDropdown.tsx` (new)
- `src/mainview/components/ViewToolbar.tsx`
- `src/shared/types.ts`
- `src/mainview/hooks/useThread.ts`
- View load path (wherever `getViews` results enter state — normalize old
  `query` there, e.g. in [AppContext.tsx](../src/mainview/context/AppContext.tsx))

## Edge cases

- Adding a duplicate keyword or form is a no-op, not a double entry.
- Removing the last selection returns the trigger to its inert label and
  drops the key from `filters` (empty arrays are not persisted).
- Only one dropdown open at a time; opening another closes the first.
- The debounced-query plumbing from ticket 35 goes away — keywords commit
  discretely on add/remove, so no debounce is needed.
