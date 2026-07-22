# Ticket 136 — Registered Tools: Test Modal with REPL & Docs

## Goal

Every registered tool gets a "Test" button opening a modal where the
user can actually run it — a guided input/output surface with a raw
terminal-style REPL and the tool's documentation visible alongside —
so a tool can be verified working before a task or workflow depends on
it.

## Acceptance criteria

### 1. Test button & modal

- Each tool row in
  [ToolsSection.tsx](../src/mainview/components/ToolsSection.tsx) gains
  a "Test" button opening a modal (standard
  [Modal.tsx](../src/mainview/components/Modal.tsx) semantics —
  Escape/backdrop close; a running invocation is cancelled on close).

### 2. Guided run + REPL

- The modal offers a command-line input prefilled with the tool's
  executable, an argument field, and a Run action; stdout/stderr stream
  into a terminal-styled output pane, exit code shown. Successive runs
  scroll like a REPL session.
- Execution goes through a consent-gated RPC on the bun side (same
  posture as the `--help` inspection consent that already exists) with
  a timeout and output cap so a runaway tool can't wedge the modal.

### 3. Docs reference

- The tool's already-captured inspection material (`--help` distilled
  spec / raw help text from the ticket-53 registry) renders in a
  side/collapsible pane, so the user tests with the docs in view.

## Files to modify

- `src/mainview/components/ToolsSection.tsx` + new
  `ToolTestModal.tsx`
- `src/bun/index.ts` / `src/shared/types.ts` / `src/mainview/rpc.ts`
  (a `testTool`-style run RPC with timeout/output cap, or reuse of an
  existing consent-gated exec path if one fits)
