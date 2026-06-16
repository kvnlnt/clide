# Ticket 13 — Grouped Repeat Submissions

## Goal

When the same form is submitted multiple times in a row, collapse the consecutive
runs into a **single FormCard** instead of stacking one card per run. The card
advertises how many submissions it holds, and the expanded view exposes each run's
output through an accordion so the user can scan results quickly. The existing
**Results / Submitted** tab states must continue to work per submission.

## Background

Today every `RunRecord` renders its own `FormCard` (see
[Thread.tsx](../src/mainview/components/Thread.tsx) and
[FormCard.tsx](../src/mainview/components/FormCard.tsx)). Re-running a form — via the
ellipsis "rerun" action or by re-submitting from the selector — produces a new run
that appears as a separate card, cluttering the thread when a user iterates on the
same form repeatedly.

`useThread` ([useThread.ts](../src/mainview/hooks/useThread.ts)) already sorts runs
(pinned first, then reverse-chronological) and groups them by date label. This ticket
adds a second grouping pass: **consecutive runs of the same form** within a date group
become one logical unit.

## Definitions

- **Run group**: an ordered list of one or more `RunRecord`s that
  - share the same `formSlug`,
  - are adjacent in the sorted thread order (no other form's run between them),
  - fall within the same date group, and
  - are **not** pinned (pinned runs always render individually — see Edge cases).
- **Latest run**: the newest run in the group (first in reverse-chronological order).
  It drives the card's collapsed summary, status icon, and timestamp.

## Acceptance criteria

### Grouping

- Two or more consecutive same-form runs render as one `FormCard` (a "grouped card").
- A single run (no adjacent same-form sibling) renders exactly as it does today —
  no visual or behavioral change.
- Inserting a different form's run between two same-form runs breaks the grouping
  (they are no longer consecutive).
- Grouping never spans date-group boundaries (a run from "Today" and one from
  "Yesterday" are not combined).
- A `running` / `pending` run still groups with its completed same-form predecessors;
  the card reflects the latest run's live status.

### Collapsed state

- The collapsed grouped card shows a **record-count data point** indicating how many
  submissions it contains (e.g. a `×3` / `3 runs` badge near the form name or
  timestamp). The badge only appears when count > 1.
- Collapsed summary, status icon, and timestamp reflect the **latest run**.
- Single-run cards show no badge.

### Expanded state

- The expanded grouped card renders submissions as an **accordion**: one collapsible
  section per run, newest first.
- Each accordion row header shows that run's timestamp, status icon, and a short
  summary so runs are distinguishable at a glance.
- Exactly one accordion section is open by default — the latest run.
- Opening/closing accordion sections is independent and does not collapse the whole card.
- Each open accordion section renders that run's output via the existing
  [OutputBlock](../src/mainview/components/output/OutputBlock.tsx), using that run's
  own `chunks` and `status`.

### Preserve Results / Submitted tabs

- The **Results / Submitted** tab control ([FormCardHeader.tsx](../src/mainview/components/FormCardHeader.tsx))
  remains available on the grouped card.
- The active tab applies to the accordion content:
  - **Results** → each open accordion section shows that run's `OutputBlock`.
  - **Submitted** → each open accordion section shows that run's read-only
    `FormCardBody` (the inputs for that specific run).
- Switching tabs preserves which accordion sections are open.

## Visual spec

- Record-count badge: small pill, reuse existing meta text styling (12px, 40% white)
  or an accent badge consistent with the sidebar badge counts. Format `×N` or `N runs`.
- Accordion row header: full-width clickable row, status icon (18px) + timestamp
  (12px 40% white) + summary (12px `#575757`) + chevron that rotates when open.
- Accordion separators: thin 1px `#3d3c3c` between rows, matching existing card dividers.
- Open section body: inset content area holding the `OutputBlock` / `FormCardBody`.

## Data model

No persistence/schema changes — grouping is a **render-time derivation** over the
existing `runs` array. Introduce a view-model type in the thread layer:

```ts
// useThread.ts
export interface RunGroup {
  key: string; // stable id, e.g. latest run id
  formSlug: string;
  runs: RunRecord[]; // newest first; length >= 1
}

export interface ThreadGroup {
  label: string;
  items: RunGroup[]; // replaces the flat RunRecord[] list
}
```

`useThread` produces `ThreadGroup.items` by walking the already-sorted `visibleRuns`
and coalescing consecutive same-form, same-date, non-pinned runs into a `RunGroup`.

## Component structure

```
Thread
  ThreadDateGroup
  FormCard (grouped)
    FormCardHeader          (name + record-count badge + Results/Submitted tabs)
    SubmissionAccordion     (new — one row per run)
      SubmissionAccordionRow
        OutputBlock         (Results tab)  — per-run chunks/status
        FormCardBody        (Submitted tab) — per-run inputs, read-only
    FormCardFooter          (only when latest run is editable/running)
```

For a single-run group, `FormCard` renders its current layout unchanged (no accordion).

## Edge cases

- **Pinned runs**: pinned runs render individually and are excluded from grouping so
  the "Pinned" section stays a flat list. (Alternatively, pinning any run in a group
  splits it out — pick the simpler rule and document it.)
- **Mixed status within a group**: each accordion section owns its status; the card's
  collapsed icon/border pulse follows the latest run only.
- **Delete a run in a group**: removing the latest run promotes the next run to
  "latest"; removing the last remaining run removes the card. Deleting down to one run
  drops the badge and accordion (renders as a normal single card).
- **Rerun action**: rerunning a grouped form should append to (re-form) the group on
  the next render, not spawn a detached card.
- **Drafts**: synthetic draft cards in [Thread.tsx](../src/mainview/components/Thread.tsx)
  are never grouped.

## Files to create / modify

- `src/mainview/hooks/useThread.ts` — add `RunGroup` derivation; change `groups` to
  emit `RunGroup[]` per date label.
- `src/mainview/components/Thread.tsx` — render one `FormCard` per `RunGroup`, passing
  the full run list.
- `src/mainview/components/FormCard.tsx` — accept an optional `runs: RunRecord[]`
  (or a `group`) prop; render accordion + record-count badge when length > 1; keep the
  single-run path intact.
- `src/mainview/components/FormCardHeader.tsx` — render the record-count badge.
- `src/mainview/components/SubmissionAccordion.tsx` — **new**, the per-run accordion.
- `src/mainview/components/SubmissionAccordionRow.tsx` — **new**, one collapsible row.

## Out of scope

- Persisting accordion open/closed state across app restarts.
- Grouping non-consecutive runs of the same form.
- Grid View ([GridView.tsx](../src/mainview/components/GridView.tsx)) — this ticket
  only affects the list/thread view.

```

```
