# Ticket 49 — New Form Creator at Full Width

## Goal

The create-new-form flow
([NewFormPage.tsx](../src/mainview/components/NewFormPage.tsx)) caps itself
at `max-w-[520px]` (describe step) / `max-w-[660px]` (fine-tune step) and
centers in the pane — a narrow column floating in empty space, inconsistent
with the full-width page treatment the other surfaces got in ticket 39. Make
it 100% of the parent width.

## Acceptance criteria

- The `max-w-[520px]` / `max-w-[660px]` wrapper and the centering
  `items-center` are removed — the page spans the pane edge-to-edge on both
  steps, adopting ticket 39's page skeleton: full-width pinned header (title
  `Create new form` / `Fine-tune — <name>` + step indicator + cancel ×),
  scrollable body, footer bar with Back / Draft / Generate spanning the full
  width.
- Use the width, don't just stretch inputs to it: on step 1 lay the fields
  out in a sensible grid at full width (e.g. Name / Project / Provider /
  Model as a two-column row group, the three description textareas full-width
  since prose benefits from length). Inputs inside a grid cell may cap their
  own width for usability, but the page layout itself must not read as a
  centered column with dead margins.
- Step 2: [SpecEditor.tsx](../src/mainview/components/SpecEditor.tsx) gets
  the same pass — check it for internal max-widths and let its sections
  (inputs, procedure, outputs, events) use the available width; the
  procedure textarea especially benefits.
- Behavior unchanged: two-step flow, validation/enablement, Escape-to-close,
  error/dependency states, and the on-success `addFormDraft` + close path.

## Files to modify

- `src/mainview/components/NewFormPage.tsx`
- `src/mainview/components/SpecEditor.tsx`

## Edge cases

- Very wide windows: full-width textareas with long lines can hurt
  readability — acceptable to cap *individual* controls (~`max-w` on a
  field, not on the page) if it looks better; the complaint is the wasted
  pane, not a demand for 4000px inputs.
- Narrow panes (sidebar open, small window): the two-column field rows wrap
  to one column instead of squeezing.
- Ticket 44's restyle touches the same inputs (`bg-[rgba(217,217,217,0.05)]`
  wells) — if 44 lands first, adopt its surface treatment here rather than
  reintroducing dark wells.
