/**
 * DISK FORMAT FIREWALL (ticket 96):
 * - Disk workflow JSON: type:"form", formSlug, "form-submitted"
 * - Memory: TaskStep.taskSlug, "task-submitted"
 * - Translation happens here on read/write.
 */

import { readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { TaskStep, Workflow, WorkflowStep, WorkflowTrigger } from "../../shared/types";
import { STEP_NAME_RE, allSteps } from "../../shared/workflowExpr";
import { ensureDir, projectWorkflowsDir, workflowPath } from "../paths";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Translate disk JSON (formSlug) → memory (taskSlug) */
export function validateSteps(raw: unknown): WorkflowStep[] {
  if (!Array.isArray(raw)) return [];
  const steps: WorkflowStep[] = [];
  for (const item of raw) {
    if (!isObject(item) || typeof item.name !== "string") continue;
    const name = item.name;
    switch (item.type) {
      case "form":
        if (typeof item.formSlug !== "string") continue; // Disk uses formSlug
        steps.push({
          type: "form",
          name,
          taskSlug: item.formSlug, // Memory uses taskSlug
          inputs: isObject(item.inputs)
            ? (Object.fromEntries(Object.entries(item.inputs).filter(([, v]) => typeof v === "string")) as Record<
                string,
                string
              >)
            : {},
          // Ticket 105: disk says formVersion, memory says taskVersion
          taskVersion: typeof item.formVersion === "number" ? item.formVersion : undefined,
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

/** Translate disk JSON (form-submitted/formSlug) → memory (task-submitted/taskSlug) */
function validateTriggers(raw: unknown): WorkflowTrigger[] {
  if (!Array.isArray(raw)) return [];
  const triggers: WorkflowTrigger[] = [];
  for (const item of raw) {
    if (!isObject(item)) continue;
    if (item.type === "manual") triggers.push({ type: "manual" });
    else if (item.type === "schedule" && typeof item.cron === "string")
      triggers.push({ type: "schedule", cron: item.cron });
    else if (item.type === "form-submitted" && typeof item.formSlug === "string") {
      // Disk: "form-submitted"/formSlug → Memory: "task-submitted"/taskSlug
      triggers.push({ type: "task-submitted", taskSlug: item.formSlug });
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

/** Translate memory (taskSlug) → disk JSON (formSlug) for persistence */
function stepsToDisk(steps: WorkflowStep[]): unknown[] {
  return steps.map((step) => {
    if (step.type === "form") {
      // Ticket 105: memory taskSlug/taskVersion → disk formSlug/formVersion
      const diskStep: Record<string, unknown> = {
        type: "form",
        name: step.name,
        formSlug: step.taskSlug,
        inputs: step.inputs,
      };
      if (step.taskVersion !== undefined) diskStep.formVersion = step.taskVersion;
      return diskStep;
    } else if (step.type === "decision") {
      return {
        type: "decision",
        name: step.name,
        condition: step.condition,
        then: stepsToDisk(step.then),
        else: step.else ? stepsToDisk(step.else) : undefined,
      };
    } else if (step.type === "loop") {
      return { type: "loop", name: step.name, over: step.over, steps: stepsToDisk(step.steps) };
    } else {
      return { type: "parallel", name: step.name, branches: step.branches.map(stepsToDisk) };
    }
  });
}

/** Translate memory (task-submitted/taskSlug) → disk JSON (form-submitted/formSlug) */
function triggersToDisk(triggers: WorkflowTrigger[]): unknown[] {
  return triggers.map((t) => {
    if (t.type === "task-submitted") {
      return { type: "form-submitted", formSlug: t.taskSlug };
    }
    return t;
  });
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

  // Translate memory representation → disk JSON format
  const diskWorkflow = {
    ...next,
    steps: stepsToDisk(next.steps),
    triggers: triggersToDisk(next.triggers),
  };
  await Bun.write(workflowPath(projectPath, slug), JSON.stringify(diskWorkflow, null, 2));
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

/** Deep-copy a workflow within the project. Returns the new workflow or null if not found. */
export async function duplicateWorkflow(projectPath: string, id: string): Promise<Workflow | null> {
  ensureDir(projectWorkflowsDir(projectPath));
  const existing = await listWorkflows(projectPath);
  const src = existing.find((w) => w.id === id);
  if (!src) return null;

  // Deep clone steps and triggers (safe JSON round-trip for our shapes).
  const cloneSteps = (s: WorkflowStep[]): WorkflowStep[] => JSON.parse(JSON.stringify(s));
  const cloneTriggers = (t: WorkflowTrigger[]): WorkflowTrigger[] => JSON.parse(JSON.stringify(t));

  // Name dedupe: "<Original> copy", then "copy 2", "copy 3", ... against ALL existing names.
  const base = `${src.name} copy`;
  const names = new Set(existing.map((w) => w.name));
  let name = base;
  if (names.has(name)) {
    let i = 2;
    while (names.has(`${base} ${i}`)) i++;
    name = `${base} ${i}`;
  }

  const now = new Date().toISOString();
  const next: Workflow = {
    ...src,
    id: crypto.randomUUID(),
    name,
    steps: cloneSteps(src.steps),
    triggers: cloneTriggers(src.triggers),
    // preserve params/description verbatim; duplicated copy must start disabled
    enabled: false,
    createdAt: now,
    updatedAt: now,
  };

  // Persist
  await saveWorkflow(projectPath, next);
  return next;
}

/**
 * Find all workflows that reference a given task slug, and return which steps
 * use it at which versions (ticket 105).
 */
export async function getWorkflowsReferencingTask(
  projectPath: string,
  taskSlug: string,
): Promise<{ workflowId: string; workflowName: string; steps: Record<string, number | undefined> }[]> {
  const workflows = await listWorkflows(projectPath);
  const results: { workflowId: string; workflowName: string; steps: Record<string, number | undefined> }[] = [];

  for (const workflow of workflows) {
    const steps = allSteps(workflow.steps);
    const taskSteps = steps.filter((s) => s.type === "form" && s.taskSlug === taskSlug) as TaskStep[];
    if (taskSteps.length === 0) continue;

    const stepVersions: Record<string, number | undefined> = {};
    for (const step of taskSteps) {
      stepVersions[step.name] = step.taskVersion;
    }
    results.push({ workflowId: workflow.id, workflowName: workflow.name, steps: stepVersions });
  }

  return results;
}

/**
 * Upgrade specified steps in a workflow to a new task version (ticket 105).
 * stepNames lists which steps to upgrade; all must be task steps referencing
 * the same task slug.
 */
export async function upgradeWorkflowTaskVersion(
  projectPath: string,
  workflowId: string,
  stepNames: string[],
  newVersion: number,
): Promise<void> {
  const workflow = await getWorkflow(projectPath, workflowId);
  if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

  const upgradeStep = (step: WorkflowStep): WorkflowStep => {
    if (step.type === "form" && stepNames.includes(step.name)) {
      return { ...step, taskVersion: newVersion };
    } else if (step.type === "decision") {
      return {
        ...step,
        then: step.then.map(upgradeStep),
        else: step.else?.map(upgradeStep),
      };
    } else if (step.type === "loop") {
      return { ...step, steps: step.steps.map(upgradeStep) };
    } else if (step.type === "parallel") {
      return { ...step, branches: step.branches.map((b) => b.map(upgradeStep)) };
    }
    return step;
  };

  const upgraded: Workflow = {
    ...workflow,
    steps: workflow.steps.map(upgradeStep),
  };

  await saveWorkflow(projectPath, upgraded);
}
