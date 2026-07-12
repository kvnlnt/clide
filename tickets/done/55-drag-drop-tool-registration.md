# Ticket 55 — Drag-and-Drop Custom Tool Registration

Part of the CLI-first re-envisioning epic (52–56). Depends on 53 (registry &
inspection); feeds 54 (its tools appear in the wizard's finder).

## Goal

Not every tool lives on PATH. Let the user register a custom CLI tool by
**dragging an executable onto the app**. The dropped tool is auto-inspected
(ticket 53: help capture + AI distillation) or, when that can't work,
documented by the user **pasting in its help text** — then it's a
first-class registry entry usable in the wizard like any other tool.

## Acceptance criteria

### 1. Drop targets

- Dropping a file onto the **Tools page** (ticket 53) or onto the wizard's
  **Find-the-tool step** (ticket 54) offers registration; both surfaces show
  an obvious dashed drop-zone affordance on drag-over.
- A drop anywhere else in the app window is ignored gracefully (no browser
  default navigation, no crash) — verify Electrobun delivers file paths to
  the webview drop event; if it needs main-process help, add the RPC.

### 2. Registration flow

- On drop: resolve the real path, check it's a file with the executable bit
  (offer one-click `chmod +x` if it's a plain file that looks like a
  program), and create a `custom` registry entry named after the binary
  (editable).
- **Inspection is consent-gated** (ticket 53): the confirm sheet shows
  exactly what will run (`/dropped/path --help`). This is an unknown binary
  — never execute it silently on drop.
- On consent: capture + AI-distill into a `ToolSpec` with the user's chosen
  service/model; show the result for review.

### 3. Paste-help fallback

- If the user declines execution, capture produces nothing useful, or they
  just prefer to: a **"Paste help text"** editor accepts the tool's docs
  (from `--help` output, a README, a man page). The pasted text is stored as
  the entry's help text and distilled by the AI the same way — or skipped
  entirely, leaving a raw entry the wizard can still build manual fields
  over.

### 4. Lifecycle

- Custom entries live in the same `~/.clide/tools/` registry: renameable,
  re-inspectable, removable from the Tools page. Removing the entry never
  touches the binary on disk.
- If the executable later disappears (moved/deleted), the entry shows a
  clear "missing" state on the Tools page and forms using it fail fast at
  run time with the ticket-52 "tool not installed" message.

## Files to modify

- `src/mainview/components/ToolsPage.tsx`, wizard finder step (drop zones)
- New: `src/mainview/components/ToolDropZone.tsx` (shared affordance)
- `src/bun/tools/registry.ts`, `src/bun/tools/inspect.ts`
- `src/bun/index.ts` (register-custom-tool RPC, chmod helper)

## Edge cases

- Dropped item is a directory, symlink (resolve it), `.app` bundle (point at
  the inner binary or reject with a clear message), or a script with a
  shebang (fine — it's executable).
- macOS Gatekeeper quarantine (`com.apple.quarantine`) can block execution
  with a confusing error — detect the attribute and surface a human
  explanation instead of a raw spawn failure.
- Dropping a binary that's already registered (same realpath) updates the
  existing entry rather than duplicating.
- Multiple files dropped at once: register each in sequence, one consent
  gate per binary.
