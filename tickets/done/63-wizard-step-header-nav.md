# Ticket 63 — Wizard Step Header Navigation

## Goal

The wizard header currently shows a passive "step N of 4" counter. Replace
it with a **step wizard indicator**: all four steps visible in the header
with their names, the current one highlighted, and every reachable step one
click away — no more spamming BACK to fix something in step 1.

## Acceptance criteria

- The header of [NewFormPage.tsx](../src/mainview/components/NewFormPage.tsx)
  renders the four steps (Describe → Tool → Fields → Output & events) as a
  connected step indicator: number/dot + short label per step, visual states
  for *complete*, *current*, and *not yet reachable*.
- **Clicking any previously visited or currently reachable step jumps
  straight to it.** Reachability mirrors the existing footer gating:
  - Step 1: always.
  - Step 2: goal description non-empty (ticket 59).
  - Steps 3–4: a tool has been selected (ticket 60).
  A not-yet-reachable step renders inert (dimmed, no pointer), with a title
  tooltip saying what's missing.
- Jumping around **never loses state**: fields, outputs, events, goal text,
  and tool choice all persist across arbitrary back-and-forth (they already
  live in `NewFormPage` state — keep it that way; no remount-per-step
  regressions).
- Step 3's auto-draft guard (ticket 61) holds under header navigation: a
  revisit doesn't re-draft over edits.
- The footer BACK/NEXT buttons remain for linear flow and stay in sync with
  the header indicator.

## Files to modify

- `src/mainview/components/NewFormPage.tsx`
- New: `src/mainview/components/WizardSteps.tsx` (presentational step
  indicator — reusable, takes steps/current/reachable/onSelect)

## Edge cases

- Changing the tool in step 2 after fields were drafted in step 3: keep the
  existing fields but surface a hint that they were drafted for the previous
  tool (re-draft is one click) — silently keeping *or* silently wiping are
  both wrong.
- Escape-to-close and CREATE behavior are unchanged regardless of which step
  is showing.

## Note

Part of the wizard cleanup batch (57–63). Depends on 59–61 for the step
names/gating; land last.
