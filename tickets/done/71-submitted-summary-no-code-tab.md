# Ticket 71 — Remove Code Tab; Submitted Becomes a Friendly Summary

*(Documented retroactively — implemented on request alongside tickets 64-69.)*

## Goal

Form cards had Results / Submitted / Code tabs. Code showed the generated
script — meaningless for command-backed forms (ticket 52) — and Submitted
was just a disabled grey copy of the form. Remove Code; make Submitted a
readable summary of what was sent, including the official command line.

## What was done

- **Code tab removed** from
  [FormCardHeader.tsx](../../src/mainview/components/FormCardHeader.tsx),
  both branches of [FormCard.tsx](../../src/mainview/components/FormCard.tsx),
  and the grouped accordion. `output/CodeOutput.tsx` had no remaining
  consumers and was deleted (the `getFormScript` RPC stays server-side for
  legacy).
- **New [SubmittedSummary.tsx](../../src/mainview/components/SubmittedSummary.tsx)**
  replaces the disabled-form rendering in both the single-run tab and
  accordion rows:
  - label → value rows (arrays joined, booleans Yes/No, empty fields
    skipped, `__aiPrompt` surfaced as "AI prompt" when present);
  - a **Command** block with the shell-quoted command line — preferring the
    argv recorded at execution time (`run.command`, ticket 52), falling
    back to rebuilding from the form's command spec for older runs, and
    omitted entirely for legacy script forms.
