import { readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { Workflow, WorkflowStep, WorkflowTrigger } from "../../shared/types";
import { STEP_NAME_RE, allSteps } from "../../shared/workflowExpr";
import { ensureDir, projectWorkflowsDir, workflowPath } from "../paths";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function validateSteps(raw: unknown): WorkflowStep[] {
  if (!Array.isArray(raw)) return [];
  const steps: WorkflowStep[] = [];
  for (const item of raw) {
    if (!isObject(item) || typeof item.name !== "string") continue;
    const name = item.name;
    switch (item.type) {
      case "form":
        if (typeof item.formSlug !== "string") continue;
        steps.push({
          type: "form",
          name,
          formSlug: item.formSlug,
          inputs: isObject(item.inputs)
            ? (Object.fromEntries(Object.entries(item.inputs).filter(([, v]) => typeof v === "string")) as Record<
                string,
                string
              >)
            : {},
        });
        break;
      case "decision":
        if (typeof item.condition !== "string") continue;
        steps.push({
          type: "decision",
          name,
          condition: item.condition,
          then: validateSteps(item.then),
          else: Array.isArray(item.else) ? validateSteps(item.else) : undefined,
        });
        break;
      case "loop":
        if (typeof item.over !== "string") continue;
        steps.push({ type: "loop", name, over: item.over, steps: validateSteps(item.steps) });
        break;
      case "parallel": {
        const branches = Array.isArray(item.branches) ? item.branches.map(validateSteps) : [];
        if (branches.length < 2) continue;
        steps.push({ type: "parallel", name, branches });
        break;
      }
    }
  }
  return steps;
}

function validateTriggers(raw: unknown): WorkflowTrigger[] {
  if (!Array.isArray(raw)) return [];
  const triggers: WorkflowTrigger[] = [];
  for (const item of raw) {
    if (!isObject(item)) continue;
    if (item.type === "manual") triggers.push({ type: "manual" });
    else if (item.type === "schedule" && typeof item.cron === "string")
      triggers.push({ type: "schedule", cron: item.cron });
    else if (item.type === "form-submitted" && typeof item.formSlug === "string") {
      triggers.push({ type: "form-submitted", formSlug: item.formSlug });
    }
  }
  return triggers;
}

function validateWorkflow(raw: unknown): Workflow | null {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  return {
    id: raw.id,
    name: raw.name,
    description: typeof raw.description === "string" ? raw.description : "",
    params: Array.isArray(raw.params) ? raw.params.filter((p): p is string => typeof p === "string") : undefined,
    steps: validateSteps(raw.steps),
    triggers: validateTriggers(raw.triggers),
    enabled: raw.enabled !== false,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "workflow"
  );
}

/** All valid workflows in a project, alphabetically. Malformed files are skipped with a warning. */
export async function listWorkflows(projectPath: string): Promise<Workflow[]> {
  ensureDir(projectWorkflowsDir(projectPath));
  let files: string[];
  try {
    files = readdirSync(projectWorkflowsDir(projectPath));
  } catch {
    return [];
  }
  const out: Workflow[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(await Bun.file(join(projectWorkflowsDir(projectPath), file)).text());
      const wf = validateWorkflow(raw);
      if (wf) out.push(wf);
      else console.warn(`[workflows] Skipping malformed workflow file: ${file}`);
    } catch {
      console.warn(`[workflows] Skipping unreadable workflow file: ${file}`);
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export async function getWorkflow(projectPath: string, id: string): Promise<Workflow | null> {
  return (await listWorkflows(projectPath)).find((w) => w.id === id) ?? null;
}

/**
 * Model-level validation on save (ticket 88): duplicate or malformed step
 * names break referencing, so they're rejected here, not just flagged in the
 * editor.
 */
export function validateForSave(workflow: Workflow): string | null {
  const steps = allSteps(workflow.steps);
  const seen = new Set<string>();
  for (const s of steps) {
    if (!STEP_NAME_RE.test(s.name)) return `Step name "${s.name}" must be slug-safe (a-z, 0-9, -, _).`;
    if (seen.has(s.name)) return `Duplicate step name "${s.name}" — names must be unique.`;
    seen.add(s.name);
  }
  for (const s of steps) {
    if (s.type === "parallel" && s.branches.length < 2) return `Parallel step "${s.name}" needs at least two branches.`;
  }
  return null;
}

/** Writes a workflow to `<project>/workflows/<slug>.json`, maintaining timestamps. */
export async function saveWorkflow(projectPath: string, workflow: Workflow): Promise<void> {
  ensureDir(projectWorkflowsDir(projectPath));
  const now = new Date().toISOString();
  const next: Workflow = { ...workflow, updatedAt: now, createdAt: workflow.createdAt || now };

  // Filename follows the name; a rename moves the file (id is identity).
  const existing = await listWorkflows(projectPath);
  const prior = existing.find((w) => w.id === workflow.id);
  if (prior && slugify(prior.name) !== slugify(next.name)) {
    try {
      unlinkSync(workflowPath(projectPath, slugify(prior.name)));
    } catch {
      /* already gone */
    }
  }
  // Avoid slug collisions between two differently-id'd workflows.
  let slug = slugify(next.name);
  if (existing.some((w) => w.id !== next.id && slugify(w.name) === slug)) slug = `${slug}-${next.id.slice(0, 8)}`;
  await Bun.write(workflowPath(projectPath, slug), JSON.stringify(next, null, 2));
}

export async function deleteWorkflow(projectPath: string, id: string): Promise<void> {
  ensureDir(projectWorkflowsDir(projectPath));
  let files: string[];
  try {
    files = readdirSync(projectWorkflowsDir(projectPath));
  } catch {
    return;
  }
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(await Bun.file(join(projectWorkflowsDir(projectPath), file)).text());
      if (isObject(raw) && raw.id === id) unlinkSync(join(projectWorkflowsDir(projectPath), file));
    } catch {
      /* skip unreadable */
    }
  }
}
