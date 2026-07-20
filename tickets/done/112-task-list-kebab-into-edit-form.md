# Ticket 112 — Remove Task List Kebab Menu; Fold Actions Into the Edit Form

## Goal

The kebab (⋮ `MoreVertical`) menu on task rows in
[TasksPanel.tsx](../src/mainview/components/TasksPanel.tsx) renders
misaligned — offset down and to the right of the icon, looking detached,
as if it belongs to something else. Rather than fix its positioning,
remove the menu entirely and move its options into the task's main edit
form.

## Current behavior

The row menu is positioned with
`left: menuRef.current?.getBoundingClientRect().right` /
`top: …bottom` on an `absolute` div inside a positioned ancestor
(~line 338) — viewport coordinates used as offset-parent coordinates,
hence the drift. It holds **Adopt task** (draft lifecycle), **Edit steps**
(browser-automation tasks), **Version history**, and delete.

## Acceptance criteria

- The ⋮ button and its popover are removed from task rows.
- The row's edit surface (pencil → metadata editor) gains the menu's
  actions, styled as part of the form:
  - **Adopt task** — shown only for `lifecycle === "draft"` with a
    successful run (same condition as today).
  - **Version history** — opens
    [TaskVersionHistoryModal.tsx](../src/mainview/components/TaskVersionHistoryModal.tsx).
  - **Edit steps** — browser-automation tasks only, opens
    [BrowserStepsEditorModal.tsx](../src/mainview/components/BrowserStepsEditorModal.tsx).
  - Delete stays wherever it currently lives outside the kebab (don't
    lose it).
- No orphaned state/refs (`menuOpen`, `menuRef`) left behind.
- The thread-card `EllipsisMenu`
  ([TaskCardHeader.tsx](../src/mainview/components/TaskCardHeader.tsx))
  is out of scope — it holds run-level actions (pin/schedule/rerun/delete)
  and is not the menu in question.

## Files to modify

- `src/mainview/components/TasksPanel.tsx`
