# Ticket 124 — Diagnostics Screen

## Goal

A diagnostics surface that shows how the app and the machine are doing:
app performance, memory usage, machine resources, and other relevant
health information.

## Acceptance criteria

### 1. Surface

- A "Diagnostics" screen reachable from Settings
  ([SettingsPanel.tsx](../src/mainview/components/SettingsPanel.tsx)
  section) — full-page style per the visual language.

### 2. Contents (minimum)

- **App**: process memory (Bun main + webview if obtainable), uptime,
  app version, data-dir path and size, run-history DB sizes per project.
- **Machine**: OS version, CPU model/load, total/free memory, free disk
  on the volume holding the app data dir.
- **Workload**: currently running runs/workflows, scheduler status
  ([scheduler.ts](../src/bun/scheduler.ts)), watcher status
  ([watcher.ts](../src/bun/tasks/watcher.ts)), registered AI services
  reachable? (cheap ping, on demand — not a background poller).
- Values refresh on an interval while the screen is open; zero polling
  cost when it isn't.

### 3. Utility

- A "Copy diagnostics" button producing a plain-text report for bug
  reports.

## Files to modify

- New `src/mainview/components/DiagnosticsPage.tsx` (or Settings
  section), `src/mainview/components/SettingsPanel.tsx`
- New `src/bun/diagnostics.ts` gathering the numbers, RPC in
  `src/bun/index.ts`, types in `src/shared/types.ts`
