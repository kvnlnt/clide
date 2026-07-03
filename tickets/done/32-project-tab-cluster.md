# Ticket 32 — Project Tab Cluster & Home Placement

## Goal

The tab strip currently mixes two different kinds of tabs with one visual
treatment, in a confusing order: project title tab → view tabs → "+" → panel
tabs (Forms / Settings / Project Settings) trailing at the far end. Two
changes:

1. The **project tab and its panel tabs** (Forms, Project Settings — and the
   global Settings tab when open) form a single **cluster that always renders
   together**, styled visibly differently from the view tabs so "project
   surfaces" and "saved views" read as two families.
2. The **House button** moves from the right-side control group in
   [WindowControls.tsx](../../src/mainview/components/WindowControls.tsx) to
   sit immediately **left of the project title tab**.

## Acceptance criteria

### 1. Cluster order & grouping

- In [ViewTabs.tsx](../../src/mainview/components/ViewTabs.tsx) the strip
  renders, left to right:
  1. Project title tab
  2. Open panel tabs (Forms / Settings / Project Settings), directly after
     the title tab — no longer trailing after "+"
  3. A visual separator (thin vertical rule or extra gap)
  4. View tabs, then the unsaved new-view tab, then "+"
- Panel tabs never detach from the title tab — opening/closing views or
  panels keeps the cluster contiguous.

### 2. Distinct styling

- Project-cluster tabs get their own treatment distinct from view tabs — e.g.
  a subtle surface tint (`bg-clide-surface` when inactive), icon-forward
  compact labels, or a different corner radius. Exact recipe is the
  implementer's call; the requirement is that a glance distinguishes the two
  families while active-tab state stays obvious in both.
- View tabs keep the current browser-tab look (rounded top corners,
  `bg-clide-bg` when active).
- Panel tabs keep their × close button and icons; view tabs keep drag-sort
  and the sliders edit button.

### 3. House button placement

- The House button (leave project → welcome screen) renders at the left edge
  of the tab strip, before the project title tab, aligned with the tabs.
- It is removed from the right-side group in `WindowControls.tsx`; Settings
  (gear) and sidebar toggle stay on the right.
- Behavior unchanged: `setActiveProject(null)` + `focusPanel(null)`. Like the
  other controls it must remain clickable inside the window drag region
  (buttons already work — only mousedown-drag is claimed).

## Files to modify

- `src/mainview/components/ViewTabs.tsx` (reorder, cluster styling, House
  button, separator)
- `src/mainview/components/WindowControls.tsx` (remove House from the right
  group)

## Edge cases

- No active project → no cluster and no House button (welcome screen state);
  the right-side group already hides itself.
- Many view tabs shrinking under `min-w-0`: the cluster should keep priority
  (`shrink-0`) so project surfaces never truncate away.
- Drag-sorting a view tab must not allow dropping into the cluster region
  (panel tabs are not drop targets today — keep it that way).
