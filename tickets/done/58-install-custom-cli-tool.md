# Ticket 58 — Install Custom CLI Tool (Upload Flow)

## Goal

Ticket 55 covered drag-and-drop registration. Make installing a custom CLI
tool a **first-class, explicit flow**: the user uploads an executable from
their machine (button + native file picker, alongside the existing drop
zone), CLIDE copies it into the app's own config storage so it survives and
can be reused forever, and documents it. The only contract the executable
must honor is **responding to `--help`** so the inspection pipeline (ticket
53) can describe it.

## Acceptance criteria

### 1. Install affordance

- The Tools section in Settings (ticket 57) gets an **"Install custom
  tool…"** button that opens the native file dialog (`Utils.openFileDialog`
  with `canChooseFiles: true`, single selection) — the picker equivalent of
  dropping a file.
- New RPC `installToolFromPath { path }`: since the main process gets a real
  filesystem path here (unlike webview drops), it reads the bytes directly —
  no base64 round-trip — then reuses the ticket-55 storage path
  (`storeDroppedBinary`-equivalent: copy into the app-data tools bin dir,
  hash-dedupe, `chmod +x`, strip `com.apple.quarantine`).

### 2. Persistent, reusable storage

- The copied executable lives under the app's config storage
  (`toolsDir()/bin`, [paths.ts](../src/bun/paths.ts)) — **the copy is the
  tool**: deleting/moving the original file on disk must not break forms
  that use it.
- The registry entry (`source: "custom"`) points at the copy; it appears in
  the Settings tools list and in the wizard's tool step (ticket 60) like any
  other tool, indefinitely across app restarts.

### 3. Documentation contract

- After install, the standard consent-gated inspection runs: the sheet
  shows `<copied path> --help`, and on confirm the help text is captured and
  AI-distilled into the entry's `ToolSpec`.
- UI copy states the contract plainly: *"Your tool only needs to support
  `--help` — CLIDE uses it to document the tool."* If `--help` yields
  nothing substantive, the paste-help fallback (ticket 53) is offered
  inline, and the tool remains usable either way.

## Files to modify

- `src/bun/index.ts` (`installToolFromPath` RPC), `src/shared/types.ts`
- `src/bun/tools/registry.ts` (path-based install sharing the dropped-bytes
  storage helper)
- Settings tools section (ticket 57's component), `src/mainview/rpc.ts`

## Edge cases

- Picked file is not executable → offer the one-click `chmod +x` before
  copying (the copy gets the bit regardless).
- Picked file is a directory, `.app` bundle, or symlink — same handling as
  ticket 55's drop path (reject with a clear message / resolve the link).
- Re-installing a byte-identical binary dedupes onto the existing entry
  (existing `sourceHash` mechanism) instead of accumulating copies.
- Removing the registry entry asks whether to also delete the copied binary
  from the bin dir (orphaned copies shouldn't pile up silently).

## Note

Part of the tools cleanup batch (57–63). Builds directly on 53/55; ships
with or after 57.
