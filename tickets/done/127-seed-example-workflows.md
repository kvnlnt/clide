# Ticket 127 — Seed Example Workflows for All Profiles

## Goal

The seed/demo content includes example *workflows*, not just tasks, so
every profile (and the starter-content flow) demonstrates the workflow
system out of the box.

## Acceptance criteria

- The starter catalog in [seed.ts](../src/bun/tasks/seed.ts) (`SEEDS`:
  currently three tasks only) gains at least one or two example
  workflows that compose the existing starter tasks — e.g. a multi-step
  workflow with a decision or loop step so the editor has something
  non-trivial to show. `listStarterTasks` / `installStarterTasks` (or a
  parallel workflow variant) install them.
- All five dev profile fixtures in
  [seed-profile.ts](../scripts/seed-profile.ts) (newbie → edge) seed
  workflow entities appropriate to the profile — the richer profiles
  should include a scheduled/recurring workflow so the Calendar and the
  workflow-schedules module have demo data.
- Seeded workflows conform to the documented schema
  ([workflow-schema.md](../docs/workflow-schema.md)) and load cleanly in
  [WorkflowsPage.tsx](../src/mainview/components/workflow/WorkflowsPage.tsx)
  and the editor.
- All five `bun run dev:*` seeders run to completion (same verification
  bar as ticket 114).

## Files to modify

- `src/bun/tasks/seed.ts` (or a sibling `src/bun/workflows/seed.ts`),
  `scripts/seed-profile.ts`
- `src/bun/index.ts` / `src/shared/types.ts` if a workflow-install RPC
  variant is needed
