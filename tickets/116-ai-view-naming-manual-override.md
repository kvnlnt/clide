# Ticket 116 — AI View Naming With Manual Override

## Goal

Views name themselves: AI generates a short name from the view's filters
and contents, and refreshes it as things change (new events, filter
edits). The user can always take over — and once they explicitly name a
view, auto-naming stops for it.

## Acceptance criteria

### 1. Auto-naming

- New views get an AI-generated name (from the view's filters + a sample
  of matching runs), replacing whatever default naming exists today.
- The name refreshes when the view's meaning changes (filters edited,
  notably different contents). Debounced/cheap — no AI call per run;
  reuse the local-summary spirit of ticket 98's `runSummary.ts`.
- No AI service configured → graceful fallback to a deterministic name
  from the filters (e.g. "errors · deploy-site").

### 2. Manual override

- **Double-click** a view tab in
  [ViewTabs.tsx](../src/mainview/components/ViewTabs.tsx) → rename dialog
  (shared [Modal.tsx](../src/mainview/components/Modal.tsx), Escape
  closes per ticket 75).
- The name is also editable **inline** on the Views page
  ([ViewsPage.tsx](../src/mainview/components/ViewsPage.tsx)).
- An explicit user-set name flips a per-view flag (e.g.
  `namedByUser: true` on `ThreadView` in `shared/types.ts` /
  [views.ts](../src/bun/tasks/views.ts)); auto-naming never touches a
  flagged view again. Inline/dialog rename stays available regardless.
- Existing hand-named views from before this ticket are treated as
  user-named (don't clobber anyone's current tabs on upgrade).

## Files to modify

- `src/mainview/components/ViewTabs.tsx`, `ViewsPage.tsx`,
  `ViewSettingsModal.tsx` (rename entry point may consolidate here)
- `src/mainview/context/AppContext.tsx`, `src/shared/types.ts`,
  `src/bun/tasks/views.ts`
- `src/bun/ai/` (new small naming helper alongside `runSummary.ts`)
