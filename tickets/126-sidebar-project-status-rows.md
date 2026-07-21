# Ticket 126 — Sidebar Project Rows: Two-Line Layout & Typed Unread Badges

## Goal

The sidebar's per-project "new" indicator becomes an informative status
line instead of a single colored dot-count. A project row gets room to
say what actually happened: how many unread successes, how many unread
errors, and how recently.

## Acceptance criteria

### 1. Type-split badges

- The unread rollup in [Sidebar.tsx](../src/mainview/components/Sidebar.tsx)
  (currently a single `{ unreadCount, hasError }` computed from
  `RunRecord.readAt`) splits into per-type counts: unread successes and
  unread errors as separate stylized chips (e.g. `30 ✓` / `10 ✗`), not
  one number whose color flips on `hasError`.
- Consider a third "needs attention" bucket distinct from hard failures
  (partial success/timeout) if the run data can distinguish it cheaply;
  if it can't, note that and skip it.

### 2. Two-line project row

- `SidebarProject` adopts a two-line layout: line one is identity
  (name), line two is the status chips plus a relative recency note
  (e.g. "latest 5m ago"). All data is local aggregation over runs the
  sidebar already loads — no new RPCs required.

### 3. Explicit clear + unread row styling

- An explicit "mark all read" affordance exists per project (the bulk
  mark-read machinery already exists in
  [history.ts](../src/bun/db/history.ts) behind the `trackUnread`
  toggle) — today the only way to clear a badge is expanding each row in
  [SubmissionAccordionRow.tsx](../src/mainview/components/SubmissionAccordionRow.tsx).
- Unread rows in the result list are visually distinct beyond the badge
  (bold title or equivalent), returning to normal weight once read.

### 4. Stretch (separate follow-up, not this ticket)

- A per-project status sparkline (last N runs as colored dots) and an
  AI one-line summary of latest activity are both explicitly out of
  scope — the AI summary in particular is an LLM call per row refresh
  and deserves its own ticket with its own cost design.

## Files to modify

- `src/mainview/components/Sidebar.tsx` (row layout, badge split, clear
  action), `src/mainview/components/SubmissionAccordionRow.tsx` (unread
  row styling)
- `src/bun/db/history.ts` / `src/bun/index.ts` only if the existing
  mark-all-read RPC needs a per-project variant
