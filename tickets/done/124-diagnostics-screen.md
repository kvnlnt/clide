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

## Implementation

`src/bun/diagnostics.ts`'s `gatherDiagnostics()` assembles everything
fresh on each call (a single `getDiagnostics` RPC, `Record<string, never>`
params) — nothing polls in the background:

- **App**: `process.memoryUsage()` (RSS/heap), `process.uptime()`,
  version read from `package.json`, the app data dir's path and a
  bounded recursive size walk (capped at 20k entries so a huge data dir
  can't stall a click), and each project's `history.db` file size.
- **Machine**: `node:os` (`platform`/`type`/`release`/`cpus`/`loadavg`/
  `totalmem`/`freemem`) plus free disk via `df -k <path>` shelled out —
  there's no portable Bun/Node API for that.
- **Workload**: small counter exports added to the existing modules that
  already track this in-memory state rather than re-deriving it —
  `runner/registry.ts` (`runningCount`), `workflows/engine.ts`
  (`activeWorkflowRunCount`), `scheduler.ts` (`armedTimerCount`),
  `workflows/schedules.ts` (`armedWorkflowTimerCount`, ticket 117's
  workflow-schedule module) — plus project count. "Watcher status" was
  scoped out: `watcher.ts` doesn't track anything instrumentable cheaply
  beyond "armed for N projects," which the project count already covers.
- **AI services**: listed with a per-service "Test" button calling the
  existing `testAIService` RPC on click — explicitly on-demand, never a
  background poller, per the ticket's own requirement.

`DiagnosticsPage.tsx` is a full-window takeover (same z-60 tier as the
profile interview, since it's launched from inside Settings and must
cover it), refreshing every 5s only while mounted (`setInterval` cleared
on unmount) plus a manual refresh button. "Copy diagnostics" formats the
full report as plain text via the existing `copyToClipboard` helper.
Reachable from a new row in `SettingsPanel.tsx`.

Verified via the Vite preview: app boots and renders with zero console
errors. Settings (and therefore Diagnostics) needs an active project to
reach in the UI, so the screen itself wasn't eyes-on verified — `tsc`
and code-read only for its actual rendering and RPC wiring.
