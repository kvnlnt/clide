# Ticket 134 — Reports: Curated, Exportable Collections

## Goal

A "report" is a curated collection of tasks, workflows, and files that
can be assembled and exported (PDF first) for sharing progress with
teammates or stakeholders. This is a new entity — nothing existing
extends into it.

## Acceptance criteria

### 1. Data model

- A `Report` entity (project-scoped, stored in the project folder per
  the self-contained-project design): name, description, ordered
  members referencing tasks (and selected runs/results), workflows
  (and selected run summaries), and files (VFS URIs). Membership
  references, not copies — the report renders fresh from current data.

### 2. Builder UI

- A Reports surface to create/edit a report: pick tasks/workflows/files,
  order sections, add free-text section notes. Follows the app's visual
  language and full-window patterns.

### 3. Export

- Export to PDF producing a clean, branded document: report title,
  generation date, per-member sections (task results, workflow run
  summaries — ticket 98's AI summaries are natural content here — and
  file listings/previews where sensible). Investigate the export
  mechanism (webview print-to-PDF vs. an HTML-to-PDF step on the bun
  side) and document the choice. A secondary Markdown export is cheap
  insurance if PDF fights back.

### 4. Scope guard

- This is an epic-sized feature; if it grows, land model + builder +
  Markdown export first and split PDF polish into a follow-up.

## Files to modify

- New `src/bun/reports/` (store + export), RPCs in `src/bun/index.ts`,
  types in `src/shared/types.ts`, wrappers in `src/mainview/rpc.ts`
- New `src/mainview/components/reports/` surface, wired into project
  navigation
