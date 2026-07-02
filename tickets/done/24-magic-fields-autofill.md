# Ticket 24 — Magic Fields: AI Auto-Fill on Open and on Event

## Goal

Make ticket 22's `magic` field config live. A magic field fills itself:

- **On form open** — when a form card with magic fields appears in the thread
  (a draft card), each `source: "prompt"` field is completed by the AI from
  its associative prompt.
- **On event** — when an event auto-submits a form (ticket 23), the event
  payload feeds each `source: "event"` field's prompt.

The user always **sees and can edit** filled values before submission — magic
fill never bypasses review, except for event-triggered runs which are
inherently unattended (they submit with filled values directly).

## Background

- Draft cards render via [Thread.tsx](../src/mainview/components/Thread.tsx)
  (synthetic idle `RunRecord`) → [FormCard.tsx](../src/mainview/components/FormCard.tsx)
  → [FormField.tsx](../src/mainview/components/FormField.tsx). Field values
  live in FormCard-local state.
- AI completions run through [providers.ts](../src/bun/ai/providers.ts)
  (`complete`), with credentials via [credentials.ts](../src/bun/ai/credentials.ts).
- Ticket 23 stores `triggeredBy` + payload on auto-submitted runs.

## Concept

```ts
// New RPC
fillMagicFields: {
  params: {
    formSlug: string;
    /** Field id → magic prompt, for the fields needing fill. */
    fields: Record<string, string>;
    /** Optional event payload context (event-triggered fills). */
    payload?: { text: string; json?: unknown };
  };
  response: { ok: boolean; values?: Record<string, string>; error?: string };
};
```

One AI call fills all requested fields at once: the prompt lists each field
(id, label, type, magic prompt) plus the payload context when present, and
demands a JSON object `{ fieldId: value }` back (reuse `extractJson`).

## Acceptance criteria

### 1. Fill on open

- When a draft FormCard mounts and its form has `source: "prompt"` magic
  fields, it requests `fillMagicFields` for exactly those fields.
- While pending, affected inputs show a subtle shimmer/spinner and a
  ✨ indicator; values land in the normal field state — fully editable, and
  user edits made during the fill are **not** overwritten (skip fields the
  user has touched).
- Fill failure (no credentials, provider error) degrades silently to empty
  fields with a small "couldn't auto-fill" hint; the form remains usable.
- Re-running a form (rerun/pin flows) does not auto-fill — only fresh draft
  cards do.

### 2. Fill on event

- In the ticket 23 auto-submit path (Bun side), before `startRun`: if the
  listening form has magic fields, call the same fill logic directly with the
  event payload as context; `source: "event"` fields get the payload-derived
  values, `source: "prompt"` fields fill normally.
- Fill failure → auto-submitted run proceeds with empty values (never blocks
  the pipeline); failure noted as a stderr-style chunk on the run.

### 3. Provider selection

- Fills use the same provider/model preference used to create the form. Store
  `aiProvider`/`aiModel` on `FormMeta` at generation time (ticket 22 writer
  addition — coordinate: add there if 22 not yet landed). Fallback: first
  provider with stored credentials.

### 4. Indicators

- [FormField.tsx](../src/mainview/components/FormField.tsx) shows a ✨ affix on
  magic-capable fields (tooltip shows the magic prompt), independent of fill
  state.

## Out of scope

- Re-fill button / manual "regenerate this field" (future nicety).
- Magic fill for scheduled runs.
- Streaming fills.

## Files to modify

- `src/shared/types.ts`, `src/bun/index.ts`, `src/mainview/rpc.ts` —
  `fillMagicFields` RPC; `FormMeta.aiProvider/aiModel`.
- New `src/bun/ai/magicFill.ts` — batched fill prompt + parsing.
- `src/bun/events/bus.ts` (or the auto-submit call site) — event-path fill.
- `src/mainview/components/FormCard.tsx` / `FormField.tsx` — fill-on-open,
  touched-field tracking, indicators.
- `src/bun/forms/writer.ts` — persist provider/model in meta.

## Edge cases

- Magic field of type select/multicheck: AI must pick from `options`;
  validate and drop invalid values.
- Number/date fields: coerce or drop non-conforming fills.
- All fields magic + event-triggered → fully autonomous pipeline (works, by
  design — cycle guard from ticket 23 still applies).
- Payload larger than ~8KB → truncate text sent to the model.
