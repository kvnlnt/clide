# Ticket 139 — Workflow "Apps": Branded Focus Bundles

## Goal

Workflows can be grouped into an "app" — a named, styled/branded bundle
that opens as its own hyperfocused UI (ideally its own window) showing
just that set of workflows, so a user can live inside one job-to-be-done
without the rest of CLIDE around them.

## Acceptance criteria

### 1. Grouping model

- The `Workflow` type in [types.ts](../src/shared/types.ts) is flat
  today — no folder/category/bundle concept. Add a project-scoped
  `WorkflowApp` entity (id, name, icon/accent color or simple branding
  fields, member workflow ids) stored alongside workflows in
  [store.ts](../src/bun/workflows/store.ts)'s territory. Membership is
  by reference; a workflow can belong to more than one app.

### 2. Bundle UI

- [WorkflowsPage.tsx](../src/mainview/components/workflow/WorkflowsPage.tsx)
  gains create/edit of apps and shows them (cards or a grouped section)
  above/alongside the flat list. Opening an app yields the focused
  surface: the app's branding + only its member workflows, with the
  existing row actions (Run / Dry-run / Runs / Edit).

### 3. Separate window

- The focused surface opens in its own window, reusing the second-window
  plumbing built for ticket 138 — this ticket should land *after* 138
  so window creation/IPC isn't invented twice. If 138 slips, a
  full-window takeover in the main window is an acceptable first
  landing, with the separate window as the follow-up.

## Files to modify

- `src/shared/types.ts`, `src/bun/workflows/store.ts` (or sibling
  `apps.ts`), RPCs in `src/bun/index.ts`, `src/mainview/rpc.ts`
- `src/mainview/components/workflow/WorkflowsPage.tsx` + new
  app-surface component; `src/bun/index.ts` window reuse from 138
