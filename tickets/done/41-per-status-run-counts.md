# Ticket 41 — Per-Status Run Counts on Form Cards

## Goal

The grouped-run badge on
[FormCardHeader.tsx](../src/mainview/components/FormCardHeader.tsx) shows one
number — the total run count — colored by only the *latest* run's status.
Replace it with **one count per status present in the group**: 3 errors → a
red "3", 2 successes → a green "2", side by side. The total-count badge goes
away.

## Acceptance criteria

- `FormCardHeader` receives the group's runs (the parent
  [FormCard.tsx](../src/mainview/components/FormCard.tsx) already holds
  `runs`; today it passes only `runCount={runs.length}` — pass the runs or a
  precomputed status→count map instead).
- The header renders a small badge per status with a nonzero count, colored
  from ticket 40's `STATUS_META` (badge background + text classes), in a
  stable order (e.g. running, scheduled, error, success, pending, idle) so
  badges don't jump around as runs finish.
- Statuses with zero runs render nothing. A single-run card shows a single
  "1" badge in that run's color (same component path — no special casing that
  diverges visually).
- Counts update live as grouped runs change status (status pushes already
  flow through context → props; no polling).
- The old `runCount` prop and its single-badge markup are removed.

## Files to modify

- `src/mainview/components/FormCardHeader.tsx`
- `src/mainview/components/FormCard.tsx`

## Edge cases

- A run whose status changes mid-view (running → error) moves between badges
  without leaving a stale total anywhere.
- Very wide groups (4+ distinct statuses) must not push the summary/time out
  of the header — badges are compact (`text-[11px]`, tight padding) and the
  summary keeps its `truncate`.

## Dependency

Consumes ticket 40's `STATUS_META` — land 40 first.
