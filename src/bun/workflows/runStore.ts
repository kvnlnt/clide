import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowRun, WorkflowRunSummary } from "../../shared/types";
import { ensureDir, projectWorkflowRunsDir, workflowRunPath } from "../paths";

/** Persists a run trace (ticket 89) — one human-readable JSON file per run, snapshot embedded. */
export async function saveRun(projectPath: string, run: WorkflowRun): Promise<void> {
  ensureDir(projectWorkflowRunsDir(projectPath));
  await Bun.write(workflowRunPath(projectPath, run.runId), JSON.stringify(run, null, 2));
}

export async function getRun(projectPath: string, runId: string): Promise<WorkflowRun | null> {
  try {
    const file = Bun.file(workflowRunPath(projectPath, runId));
    if (!(await file.exists())) return null;
    return JSON.parse(await file.text()) as WorkflowRun;
  } catch {
    return null;
  }
}

export async function listRuns(projectPath: string, workflowId?: string): Promise<WorkflowRunSummary[]> {
  ensureDir(projectWorkflowRunsDir(projectPath));
  let files: string[];
  try {
    files = readdirSync(projectWorkflowRunsDir(projectPath));
  } catch {
    return [];
  }
  const out: WorkflowRunSummary[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const run = JSON.parse(await Bun.file(join(projectWorkflowRunsDir(projectPath), file)).text()) as WorkflowRun;
      if (workflowId && run.workflowId !== workflowId) continue;
      out.push({
        runId: run.runId,
        workflowId: run.workflowId,
        status: run.status,
        trigger: run.trigger,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
      });
    } catch {
      /* skip unreadable run files */
    }
  }
  out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return out;
}

/** App-launch sweep (ticket 89): in-flight runs from a previous session are marked failed. */
export async function failInterruptedRuns(projectPath: string): Promise<void> {
  for (const summary of await listRuns(projectPath)) {
    if (summary.status !== "running") continue;
    const run = await getRun(projectPath, summary.runId);
    if (!run) continue;
    run.status = "failed";
    run.finishedAt = run.finishedAt ?? new Date().toISOString();
    for (const rec of run.records) {
      if (rec.status === "running" || rec.status === "pending") {
        rec.status = "failed";
        rec.note = "interrupted — app quit mid-run";
      }
    }
    await saveRun(projectPath, run);
  }
}

/** Mark workflow runs as read (ticket 97). */
export async function markWorkflowRunsRead(projectPath: string, runIds: string[]): Promise<void> {
  if (runIds.length === 0) return;
  const now = new Date().toISOString();
  for (const runId of runIds) {
    const run = await getRun(projectPath, runId);
    if (!run) continue;
    run.readAt = now;
    await saveRun(projectPath, run);
  }
}

/** Mark all unread workflow runs in a project as read (ticket 97 toggle-on bulk-mark). */
export async function markAllWorkflowRunsRead(projectPath: string): Promise<void> {
  const now = new Date().toISOString();
  for (const summary of await listRuns(projectPath)) {
    const run = await getRun(projectPath, summary.runId);
    if (!run || run.readAt) continue;
    run.readAt = now;
    await saveRun(projectPath, run);
  }
}
