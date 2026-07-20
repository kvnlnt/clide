# Ticket 108 — Interview Error Recovery & Cancel

## Goal

A profile interview must never be a dead end. Every AI call can fail
("Error: RPC request timed out." was observed live) and today the takeover
offers no retry and no way out — the user had to force-quit the app.

## Acceptance criteria

### 1. Always escapable

- [ProfileInterviewPage.tsx](../src/mainview/components/ProfileInterviewPage.tsx)
  is a full-window takeover; it must always render a working close/cancel
  affordance (× button + Escape), in **every** phase (`asking`,
  `drafting`, `review`, `saving`) — including while a request is in
  flight and after an error.
- Cancel mid-interview discards nothing silently: confirm ("Discard this
  interview?") only if answers were already given.

### 2. Error states with recovery paths

- Any failed AI call (next question, drafting, saving) renders an inline
  error state with **Retry** and **Cancel interview** actions — not a
  frozen spinner or a bare error string.
- Retry re-issues just the failed call with the transcript intact; answers
  already given are never lost by a failure.

### 3. Timeouts

- Long-running interview RPCs get a client-side timeout that lands in the
  same error state (no infinitely pending promise). Audit the RPC layer
  ([rpc.ts](../src/mainview/rpc.ts)) so an Electrobun RPC timeout is
  caught, not thrown unhandled.

## Sweep

While here, sweep the other AI-driven takeovers (first-run wizard, task
wizard drafting) for the same trap: any awaited AI call whose failure
leaves the UI stuck. Fix instances found or note them for follow-up.

## Files to modify

- `src/mainview/components/ProfileInterviewPage.tsx`, `src/mainview/rpc.ts`
- `src/bun/index.ts`, `src/bun/ai/interview.ts` (surface errors as values,
  not throws, where they aren't already)
