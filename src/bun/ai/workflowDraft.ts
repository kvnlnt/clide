import type { AIService, TaskFolder, Workflow, WorkflowStep } from "../../shared/types";
import { STEP_NAME_RE, allSteps, templateRefs } from "../../shared/workflowExpr";
import { validateSteps } from "../workflows/store";
import { profileContext } from "./profileContext";
import { complete } from "./providers";

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI response did not contain JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

/** Compact catalog of the project's tasks — all the model may reference. */
function taskCatalog(tasks: TaskFolder[]): string {
  return JSON.stringify(
    tasks.map((t) => ({
      slug: t.meta.slug,
      name: t.meta.name,
      description: t.meta.description,
      fields: t.task.fields.map((field) => ({ id: field.id, label: field.label, type: field.type })),
      outputs: (t.task.outputs ?? []).map((o) => ({ name: o.name, kind: o.kind })),
    })),
    null,
    2,
  );
}

// The "form" step type and "formSlug" field below are the disk-format-firewalled
// wire shape (see workflows/store.ts) — validateSteps() below is reused as-is to
// parse this AI response, so the schema the model is asked to produce must match
// disk JSON exactly even though the product concept is "task".
const SYSTEM_PROMPT = [
  "You draft a CLIDE Workflow: an ordered list of steps orchestrating the user's EXISTING tasks.",
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
  "- formSlug MUST be one of the cataloged tasks. Never invent tasks or field ids.",
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
 * tasks (ticket 92). Validation is strict and partial: unknown task slugs
 * are dropped with a visible note, unknown field ids are dropped, reference
 * syntax is checked, names de-duplicated — a partially valid draft is
 * delivered partially, never all-or-nothing.
 */
export async function draftWorkflow(
  goal: string,
  name: string,
  tasks: TaskFolder[],
  service: AIService,
  model: string,
  projectPath?: string,
  projectName?: string,
): Promise<WorkflowDraftResult> {
  // Standing profile context (tickets 100/101) — capped, background only.
  const profile = await profileContext(projectPath, projectName);
  const user = [
    profile || null,
    `The user's goal for this workflow: ${goal}`,
    `Available tasks (the ONLY tasks you may use):\n${taskCatalog(tasks)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const raw = await complete({ ...service, model }, { system: SYSTEM_PROMPT, user });
  const parsed = extractJson(raw) as { steps?: unknown };
  let steps = validateSteps(parsed.steps);
  const notes: string[] = [];

  // Drop steps referencing tasks that don't exist (and their now-dangling references stay visible in the editor).
  const known = new Set(tasks.map((t) => t.meta.slug));
  const knownFieldIds = new Map(tasks.map((t) => [t.meta.slug, new Set(t.task.fields.map((x) => x.id))]));

  const prune = (list: WorkflowStep[]): WorkflowStep[] =>
    list.flatMap((step): WorkflowStep[] => {
      if (step.type === "form") {
        if (!known.has(step.taskSlug)) {
          notes.push(`No task found for "${step.taskSlug}" — add a step manually or create that task first.`);
          return [];
        }
        const valid = knownFieldIds.get(step.taskSlug)!;
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
