# Ticket 62 — Wizard Step 4: Remove the Effects Section

## Goal

Step 4's outputs editor still carries the "effects" concept from the
script-era spec flow (ticket 22) — free-text side-effect rows that no longer
make sense for command-backed forms. Remove effects from the authoring UI;
step 4 is output kind(s) plus event wiring, nothing else.

## Acceptance criteria

- The `OutputsSection` used by the wizard
  ([SpecEditor.tsx](../src/mainview/components/SpecEditor.tsx), consumed by
  [NewFormPage.tsx](../src/mainview/components/NewFormPage.tsx)) loses the
  effect rows and the "Add effect" button — only the output-kind toggle
  chips remain. If the legacy spec flow's own editor still needs effects,
  split the component rather than forking behavior with a prop maze; if
  nothing else uses effects authoring, delete it outright.
- The wizard's `createCommandForm` payload never contains `kind: "effect"`
  entries.
- **Reading is unchanged**: `OutputSpec`'s `"effect"` kind stays in
  [types.ts](../src/shared/types.ts) and
  [loader.ts](../src/bun/forms/loader.ts) keeps accepting it, so existing
  forms on disk with effect entries load and run exactly as before — this
  ticket only removes the ability to author new ones.
- Emits / Listens-for tag editors are untouched.

## Files to modify

- `src/mainview/components/SpecEditor.tsx` (or a new slimmer
  `OutputKindPicker`)
- `src/mainview/components/NewFormPage.tsx`

## Edge cases

- A future "edit form in wizard" flow (ticket 54's deferred section) opening
  a legacy form that has effect entries must not silently drop them on save
  — preserve unknown/effect outputs pass-through. Note this in the component
  for whoever wires editing.

## Note

Part of the wizard cleanup batch (57–63). Smallest of the set; lands any
time.
