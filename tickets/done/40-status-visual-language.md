# Ticket 40 — Illustrate All Status Types

## Goal

Every `RunStatus` — `idle`, `pending`, `running`, `success`, `error`,
`scheduled` — gets a distinct, consistent visual identity (icon + color +
label), applied everywhere a status appears. Today the treatment is patchy
([statusIcon.tsx](../src/mainview/components/statusIcon.tsx)):

- `idle` renders as an invisible empty span in default mode.
- `pending` and `running` share the same white spinner — indistinguishable.
- Dot mode collapses `idle` / `pending` / `running` into the same white dot.
- The status filter dropdown ([ViewToolbar.tsx](../src/mainview/components/ViewToolbar.tsx))
  and the Views page summaries ([ViewsPage.tsx](../src/mainview/components/ViewsPage.tsx))
  show statuses as plain text with no illustration at all.

## Acceptance criteria

### 1. One canonical status map

- A single exported map in `statusIcon.tsx` (e.g. `STATUS_META`) defining per
  status: lucide icon, Tailwind color classes (text + badge background), and
  display label. Suggested distinct identities:
  - `idle` — hollow circle, neutral gray
  - `pending` — clock/hourglass, muted blue (waiting, not yet spinning)
  - `running` — spinner (animated), blue
  - `success` — check, green
  - `error` — ×, red
  - `scheduled` — alarm clock, orange
- `StatusIcon` (both `default` and `dot` modes) renders from the map; every
  status is visibly distinct in both modes — no empty spans, no shared colors.

### 2. Consumers use the map

- The status chips/rows in the ViewToolbar status dropdown show the icon +
  color next to the label.
- `ViewsPage` filter summaries and any other status text can pull the label
  (and optionally color) from the map instead of raw enum strings.
- The per-status badge colors hardcoded in
  [FormCardHeader.tsx](../src/mainview/components/FormCardHeader.tsx) come
  from the map (ticket 41 reworks that badge — coordinate).

## Files to modify

- `src/mainview/components/statusIcon.tsx`
- `src/mainview/components/ViewToolbar.tsx`
- `src/mainview/components/ViewsPage.tsx`
- `src/mainview/components/FormCardHeader.tsx` (colors only; counts are ticket 41)

## Edge cases

- Tailwind must see the color classes as complete literal strings in the map
  (no runtime string concatenation) or they'll be purged from the build.
- `pinned` prop on `StatusIcon` is currently accepted but unused — remove it
  or implement it; don't leave it dangling.
