# Ticket 83 — AI-Assisted Workflow Creation Wizard

Part of the Workflow epic (79-86). Depends on 79 (model) and 82 (editor —
the wizard's fine-tune stage).

## Goal

Creating a workflow works like creating a form (tickets 59-63): the user
**expresses what they want**, the system checks the request against the
project's **existing forms** and pre-fills a workflow configuration —
steps, wiring, even suggested decisions/loops — and the user fine-tunes it
in the ticket-82 editor. AI accelerates, never gates: skipping the describe
step lands in an empty editor.

## Acceptance criteria

### 1. Describe step

- Step 1 mirrors the form wizard's goal-first layout (ticket 59): a labeled
  description box (*"What should this workflow do?"* — with instructions
  that CLIDE will assemble it from the project's existing forms), name,
  and the session `ServiceModelPicker`.

### 2. AI draft against existing forms

- New RPC `draftWorkflow { project, goal, serviceId, model }`: the prompt
  carries a compact catalog of the project's forms — name, slug,
  description, field ids/labels, output definition names (ticket 77) — and
  the workflow schema (ticket 79), and asks for a draft `Workflow` JSON:
  ordered form steps referencing **only cataloged forms**, `{{…}}` wiring
  between outputs and inputs, decisions/loops where the goal implies them.
- Validation on the response is as strict as `commandFields.ts`'s: unknown
  form slugs are dropped with a visible note ("no form found for X — add a
  step manually or create that form first"), reference syntax is checked
  with the shared parser, step names de-duplicated. A partially valid draft
  is delivered partially — never all-or-nothing.
- Where the goal needs a form that doesn't exist, the draft may include a
  **placeholder step** (clearly marked "missing form: describe-and-create")
  that deep-links into the form-creation wizard; returning resumes the
  workflow draft.

### 3. Fine-tune

- The draft opens in the ticket-82 editor (same controlled `Workflow`
  value), with a hint bar ("AI drafted 4 steps from 3 of your forms —
  review the wiring"). Re-draft affordance mirrors the form wizard's
  ("Re-draft with AI", never clobbering silently after manual edits —
  ticket 61's guard pattern).
- Manual path: "Start empty" from step 1 goes straight to the editor.

## Files to modify

- New: `src/mainview/components/workflow/NewWorkflowWizard.tsx`
- New: `src/bun/ai/workflowDraft.ts` (catalog + prompt + strict validation)
- `src/shared/types.ts`, `src/bun/index.ts`, `src/mainview/rpc.ts`
- `src/mainview/components/workflow/WorkflowEditor.tsx` (hint bar,
  placeholder-step rendering)

## Edge cases

- Project with zero forms: the wizard says so up front and points at form
  creation instead of burning an AI call.
- The model inventing field ids for a real form: unknown field ids are
  dropped from the step's inputs (the field editor shows them empty), noted
  in the hint bar.
- No AI service configured: describe step degrades to name + "Start empty",
  matching the form wizard's degradation rule.

## Note

Prompt design tip recorded for the implementer: include 1-2 few-shot
examples from `docs/workflow-schema.md` — draft quality on nested
decision/loop structures is the risk area.
