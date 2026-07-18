import type { AIService, FormFolder, Workflow, WorkflowStep } from "../../shared/types";
import { STEP_NAME_RE, allSteps, templateRefs } from "../../shared/workflowExpr";
import { validateSteps } from "../workflows/store";
import { complete } from "./providers";

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI response did not contain JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

/** Compact catalog of the project's forms — all the model may reference. */
function formCatalog(forms: FormFolder[]): string {
  return JSON.stringify(
    forms.map((f) => ({
      slug: f.meta.slug,
      name: f.meta.name,
      description: f.meta.description,
      fields: f.form.fields.map((field) => ({ id: field.id, label: field.label, type: field.type })),
      outputs: (f.form.outputs ?? []).map((o) => ({ name: o.name, kind: o.kind })),
    })),
    null,
    2,
  );
}

const SYSTEM_PROMPT = [
  "You draft a CLIDE Workflow: an ordered list of steps orchestrating the user's EXISTING forms.",
  "Respond ONLY with a single JSON object:",
  `{
  "steps": Step[]
}
where Step is one of:
{ "type": "form", "name": string, "formSlug": string, "inputs": { "<fieldId>": string } }
{ "type": "decision", "name": string, "condition": string, "then": Step[], "else": Step[] }
{ "type": "loop", "name": string, "over": string, "steps": Step[] }
{ "type": "parallel", "name": string, "branches": Step[][] }`,
  "Rules:",
  '- Step names: unique, slug-safe (^[a-z][a-z0-9_-]*$), descriptive, e.g. "fetch_rss".',
  "- formSlug MUST be one of the cataloged forms. Never invent forms or field ids.",
  "- Input values are literals or contain {{references}}: {{stepname.outputs.<outputName>}}, {{stepname.stdout}}, {{item.<prop>}} inside loops, {{trigger.params.<name>}}.",
  "- Only reference steps that complete earlier (earlier siblings / ancestors' earlier siblings).",
  "- Expressions (condition/over) support property access, .length, comparisons (== != < <= > >=), && || !, literals.",
  "- Prefer a flat sequence; use decision/loop/parallel only when the goal clearly implies them.",
].join("\n");

export interface WorkflowDraftResult {
  workflow: Workflow;
  notes: string[];
}

/**
 * Drafts a workflow from the user's goal against the project's existing
 * forms (ticket 92). Validation is strict and partial: unknown form slugs
 * are dropped with a visible note, unknown field ids are dropped, reference
 * syntax is checked, names de-duplicated — a partially valid draft is
 * delivered partially, never all-or-nothing.
 */
export async function draftWorkflow(
  goal: string,
  name: string,
  forms: FormFolder[],
  service: AIService,
  model: string,
): Promise<WorkflowDraftResult> {
  const user = [
    `The user's goal for this workflow: ${goal}`,
    `Available forms (the ONLY forms you may use):\n${formCatalog(forms)}`,
  ].join("\n\n");

  const raw = await complete({ ...service, model }, { system: SYSTEM_PROMPT, user });
  const parsed = extractJson(raw) as { steps?: unknown };
  let steps = validateSteps(parsed.steps);
  const notes: string[] = [];

  // Drop steps referencing forms that don't exist (and their now-dangling references stay visible in the editor).
  const known = new Set(forms.map((f) => f.meta.slug));
  const knownFieldIds = new Map(forms.map((f) => [f.meta.slug, new Set(f.form.fields.map((x) => x.id))]));

  const prune = (list: WorkflowStep[]): WorkflowStep[] =>
    list.flatMap((step): WorkflowStep[] => {
      if (step.type === "form") {
        if (!known.has(step.formSlug)) {
          notes.push(`No form found for "${step.formSlug}" — add a step manually or create that form first.`);
          return [];
        }
        const valid = knownFieldIds.get(step.formSlug)!;
        const inputs: Record<string, string> = {};
        for (const [fieldId, value] of Object.entries(step.inputs)) {
          if (valid.has(fieldId)) inputs[fieldId] = value;
          else notes.push(`Dropped unknown field "${fieldId}" on step "${step.name}".`);
        }
        return [{ ...step, inputs }];
      }
      if (step.type === "decision")
        return [{ ...step, then: prune(step.then), else: step.else ? prune(step.else) : undefined }];
      if (step.type === "loop") return [{ ...step, steps: prune(step.steps) }];
      return [{ ...step, branches: step.branches.map(prune) }];
    });
  steps = prune(steps);

  // De-duplicate / sanitize step names.
  const seen = new Set<string>();
  for (const step of allSteps(steps)) {
    let candidate = STEP_NAME_RE.test(step.name)
      ? step.name
      : step.name
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, "_")
          .replace(/^[^a-z]+/, "step_");
    if (!candidate || !STEP_NAME_RE.test(candidate)) candidate = "step";
    let n = 2;
    let unique = candidate;
    while (seen.has(unique)) unique = `${candidate}_${n++}`;
    if (unique !== step.name) notes.push(`Renamed step "${step.name}" → "${unique}".`);
    step.name = unique;
    seen.add(unique);
  }

  // Surface template syntax errors as notes (the editor flags them live too).
  for (const step of allSteps(steps)) {
    if (step.type === "form") {
      for (const [fieldId, value] of Object.entries(step.inputs)) {
        const { errors } = templateRefs(value);
        for (const e of errors) notes.push(`Step "${step.name}" field "${fieldId}": ${e}`);
      }
    }
  }

  const now = new Date().toISOString();
  return {
    workflow: {
      id: crypto.randomUUID(),
      name: name.trim() || "New workflow",
      description: goal.trim(),
      steps,
      triggers: [{ type: "manual" }],
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    notes,
  };
}
