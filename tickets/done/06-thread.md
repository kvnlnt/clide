# Ticket 06 — Thread

## Goal
Build the main thread area — the scrollable list of FormCards that makes up the core of the CLIDE experience.

## Acceptance criteria
- Thread shows all runs for the currently selected project, newest at the top (reverse-chronological)
- The top-most item is always the "active" form — the one most recently added from the form selector, rendered expanded
- Past runs are rendered as collapsed FormCards below, separated by date group headers ("Today", "Yesterday", dates)
- Thread scrolls independently; the top bar and active form remain sticky at top
- Runs are grouped by a `label` if one exists (e.g. "STREAM" separator from Figma) — this is an optional `group label` that can be set on a run
- Empty state: centered prompt "✦ Type a form name to get started" 
- Thread updates in real-time as new runs are added or status changes

## Visual spec (from Figma)
- Thread background: `#141414` (no card background for the thread itself)
- Active expanded form: rendered in an `#0a0a0a` card at the top of the content area
- Collapsed run rows: no card background, full-width rows with left padding ~270px from window edge
- Group labels (e.g. "STREAM"): small 12px bold uppercase text `#575757`, left-aligned with run rows, with a subtle top margin
- Separator lines between major sections (thin 1px `#3d3c3c`)
- Scroll: standard OS scrollbar, hidden until hover
- Collapsed chevron-up at bottom center of the window (from Figma) — collapses/scrolls the active form out of view

## Thread state model
```ts
interface ThreadState {
  activeRunId: string | null       // the expanded form at top
  runs: RunRecord[]                // all runs for current project, newest first
  projectFilter: string | null     // project from sidebar selection
}
```

Run ordering:
1. Pinned runs float to top of the history section (below the active card)
2. Then reverse-chronological by `started_at`

## Files to create/modify
- `src/mainview/components/Thread.tsx`
- `src/mainview/components/ThreadDateGroup.tsx` — date separator heading
- `src/mainview/components/ThreadEmpty.tsx` — empty state
- `src/mainview/hooks/useThread.ts` — manages thread state, subscribes to RPC run updates
