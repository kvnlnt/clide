# Ticket 51 — Additive Filter Chips

## Goal

The view toolbar ([ViewToolbar.tsx](../src/mainview/components/ViewToolbar.tsx))
currently shows three always-present filter dropdowns (Forms / Status /
Keywords, ticket 36) whether or not they're in use. Replace that with an
**additive chip model**: an empty view shows just a **"+" button**; clicking
it lets the user pick a filter type and its criteria, which lands in the
toolbar as a **chip**. Chips are clickable to edit, have an **×** to remove,
and all active chips combine as an **AND** over the thread.

## Acceptance criteria

### 1. "+" add-filter button

- The three permanent dropdown triggers are gone. In their place: a compact
  "+" button (Lucide `Plus`), toolbar-button styling.
- Clicking "+" opens a popover (build on
  [PortalPopover.tsx](../src/mainview/components/PortalPopover.tsx)) with two
  steps:
  1. **Pick a type**: Form, Status, or Keyword.
  2. **Pick criteria** for that type, reusing the existing controls:
     - Form → autocomplete over the project's forms (existing suggestion
       logic), multi-selectable.
     - Status → the five checkbox rows with `STATUS_META` icons.
     - Keyword → text input, Enter adds; multiple keywords allowed.
- Confirming criteria closes the popover and adds a chip. A type step with
  zero criteria selected adds nothing.

### 2. Chips

- Each active filter renders as a chip in the toolbar row, after the "+"
  button: a short summary label (e.g. `Form: Deploy`, `Status: Error +1`,
  `Keyword: "staging"`) plus an **×** that removes the chip immediately.
- **Clicking the chip body reopens the criteria popover** for that chip's
  type, pre-populated, editing in place (live-apply via `updateView`, as
  today).
- Chips wrap or truncate gracefully; the toolbar must not push the kebab
  (ticket 50) off-screen with many chips.

### 3. AND semantics

- **Across chips: AND** — a run must satisfy every chip to appear.
- **Within a chip: OR** — a chip's criteria list matches if *any* value
  matches (a Status chip with Error + Success matches either; a Keyword chip
  with several keywords matches any of them). This keeps same-type chips
  useful: two Keyword chips = both must match (the old `keywordMode: "and"`),
  one Keyword chip with two values = either matches (the old `"or"`).
- Update `matchesView` in
  [useThread.ts](../src/mainview/hooks/useThread.ts) accordingly.

### 4. Data model & migration

- `ThreadViewFilters` ([types.ts](../src/shared/types.ts)) becomes a list of
  filter entries, e.g.
  `entries?: { type: "form" | "status" | "keyword"; values: string[] }[]`.
- `keywordMode` is retired — the chip structure now expresses it.
- **Migration** (in the same load-path normalization spot as ticket 36, e.g.
  [AppContext.tsx](../src/mainview/context/AppContext.tsx)): old `.views.json`
  files load losslessly —
  - `formSlugs` → one `form` entry with those values;
  - `statuses` → one `status` entry;
  - `keywords` + `keywordMode: "or"` (or unset) → one `keyword` entry;
  - `keywords` + `keywordMode: "and"` → one `keyword` entry per keyword;
  - legacy `query` → one single-value `keyword` entry.
- Update `filterSummary` in
  [ViewsPage.tsx](../src/mainview/components/ViewsPage.tsx) for the new shape.

## Files to modify

- `src/mainview/components/ViewToolbar.tsx`
- `src/mainview/components/MultiSelectDropdown.tsx` (likely absorbed or
  replaced by the new chip/popover components — delete if unused)
- `src/shared/types.ts`
- `src/mainview/hooks/useThread.ts`
- `src/mainview/context/AppContext.tsx` (migration)
- `src/mainview/components/ViewsPage.tsx` (summary text)

## Edge cases

- Removing a chip's last criteria value (from the edit popover) removes the
  chip itself; an empty `entries` array is not persisted.
- Duplicate values within a chip are no-ops; adding a second chip of the same
  type is allowed (that's the AND-across mechanism).
- Two chips of the same type with disjoint single values (e.g. `Form: A` AND
  `Form: B`) legitimately match nothing — acceptable, but the empty-thread
  state should render normally, not error.
- Only one popover open at a time; opening the "+" or a chip editor closes
  any other open surface, including the kebab modal (ticket 50).
