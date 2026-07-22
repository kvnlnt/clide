import type { StarterWorkflow, Workflow, WorkflowStep, WorkflowTrigger } from "../../shared/types";
import { loadProjects } from "../config";
import { saveWorkflow } from "./store";

interface WorkflowSeed {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  triggers?: WorkflowTrigger[];
}

/**
 * Starter workflow catalog (ticket 127) — composes the demo tasks in
 * ../tasks/seed.ts's SEEDS ("list-files", "system-info"), so both must be
 * present in the target project for these to run cleanly. Mirrors the
 * starter-task catalog pattern (ticket 111): a flat list installable into
 * any project, decision/loop each get one example so the editor has
 * something non-trivial to show.
 */
const WORKFLOW_SEEDS: WorkflowSeed[] = [
  {
    id: "system-report",
    name: "System Report",
    description: "Lists a directory, then checks system info if it worked — a task step feeding a decision.",
    steps: [
      { type: "form", name: "list_files", taskSlug: "list-files", inputs: { dir: "~" } },
      {
        type: "decision",
        name: "files_ok",
        condition: "list_files.exitCode == 0",
        then: [{ type: "form", name: "check_system", taskSlug: "system-info", inputs: {} }],
      },
    ],
  },
  {
    id: "directory-loop",
    name: "Directory Loop",
    description: "Checks system info, then lists a directory once per reported check — a loop over a real output.",
    steps: [
      { type: "form", name: "sys_info", taskSlug: "system-info", inputs: {} },
      {
        type: "loop",
        name: "for_each_check",
        over: "sys_info.outputs.checks",
        steps: [{ type: "form", name: "list_files_for_check", taskSlug: "list-files", inputs: { dir: "~" } }],
      },
    ],
  },
];

/** The starter-workflow catalog offered alongside starter tasks (ticket 127). */
export function listStarterWorkflows(): StarterWorkflow[] {
  return WORKFLOW_SEEDS.map(({ id, name, description }) => ({ id, name, description }));
}

async function writeWorkflowSeed(projectPath: string, seed: WorkflowSeed, now: string): Promise<void> {
  const workflow: Workflow = {
    id: crypto.randomUUID(),
    name: seed.name,
    description: seed.description,
    steps: seed.steps,
    triggers: seed.triggers ?? [{ type: "manual" }],
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
  await saveWorkflow(projectPath, workflow);
}

/** Install the chosen starter workflows into an existing project (ticket 127). */
export async function installStarterWorkflows(projectName: string, ids: string[]): Promise<{ ok: boolean; error?: string }> {
  const project = (await loadProjects()).find((p) => p.name === projectName);
  if (!project) return { ok: false, error: `Unknown project "${projectName}"` };
  const chosen = WORKFLOW_SEEDS.filter((w) => ids.includes(w.id));
  if (chosen.length === 0) return { ok: true };
  const now = new Date().toISOString();
  try {
    for (const seed of chosen) await writeWorkflowSeed(project.path, seed, now);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
