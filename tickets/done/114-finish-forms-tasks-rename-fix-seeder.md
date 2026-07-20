# Ticket 114 — Finish the Forms→Tasks Rename; Fix the Broken Profile Seeders

## Goal

Ticket 96 renamed "form" → "task" product-wide but left stragglers in the
code, and one of them **breaks all seeded dev profiles**: every
`bun run dev:<profile>` (`newbie`, `beginner`, `regular`, `power`, `edge`)
dies with `SQLiteError: NOT NULL constraint failed: runs.form_slug`.
Finish the rename at the code-identifier level and get the seeders
running again.

## Root cause of the seeder crash (confirmed)

[seed-profile.ts](../scripts/seed-profile.ts) `seedRun()` calls
`createRun(projectPath, { id, formSlug, … })`, but
[history.ts](../src/bun/db/history.ts) `CreateRunInput` was renamed to
take `taskSlug` (which it writes to the disk column `form_slug`). The
seeder's `formSlug` key is silently ignored, `input.taskSlug` is
`undefined`, and the `NOT NULL` constraint on `runs.form_slug` fires.

## Acceptance criteria

### 1. Seeders work

- `scripts/seed-profile.ts` passes `taskSlug` (rename its local
  `formSlug` params/identifiers too), and all five `dev:*` profiles seed
  and launch cleanly.

### 2. Rename sweep

- Sweep the codebase for leftover `form`-named **code identifiers** that
  ticket 96 missed and rename them, including at least:
  - [AppContext.tsx](../src/mainview/context/AppContext.tsx): `forms`,
    `formsBySlug`, `addFormDraft`, `openNewForm`, `deleteForm`, and the
    `"forms"` value of `ProjectSurface`.
  - Component-local `form` variables (e.g. `TasksPanel.tsx` maps
    `results.map((form, …))`), `writeTemplateForm` in the seeder, etc.
  - Grep guide: `grep -rni "form" src scripts --include="*.ts*"` and
    triage each hit.

### 3. Disk-format firewall stays

- Per [00-overview.md](00-overview.md), **on-disk names do not change**:
  the `forms/` directory, `form.json`, and DB columns
  `form_slug`/`form_version` stay for backward compatibility. The
  firewall comments in `history.ts` marking disk↔memory mapping are the
  pattern — keep the boundary explicit, rename everything on the memory
  side of it.
- Type-check (`tsc`) and a smoke run of each dev profile pass.

## Files to modify

- `scripts/seed-profile.ts`, `src/mainview/context/AppContext.tsx`, plus
  whatever the sweep turns up (`src/mainview/components/*`,
  `src/bun/tasks/*`, `src/shared/types.ts`)

## Source items

Covers feedback items 9 ("forms" still in code) and 21 (`dev:*` scripts
broken) — same root cause.
