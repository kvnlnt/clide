/**
 * Report export (ticket 134): Markdown first (cheap, no new dependency —
 * template-string assembly), PDF investigated as a follow-up per the
 * ticket's own scope guard. Renders fresh from current run/file data every
 * time — a report never stores copies of what it references.
 */

import { getRun as getTaskRun, getRunHistory } from "../db/history";
import { ensureDir, projectReportExportsDir } from "../paths";
import type { Report, ReportFileMember, ReportTaskMember, ReportWorkflowMember, RunRecord, WorkflowRun } from "../../shared/types";
import { getRun as getWorkflowRun, listRuns as listWorkflowRuns } from "../workflows/runStore";

const PREVIEW_MIME_PREFIXES = ["text/", "application/json"];
const PREVIEW_MAX_BYTES = 2000;

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "report"
  );
}

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

function renderTaskRun(run: RunRecord): string {
  const lines: string[] = [];
  lines.push(`- **Status:** ${run.status}`);
  lines.push(`- **Started:** ${fmt(run.startedAt)}`);
  lines.push(`- **Finished:** ${fmt(run.finishedAt)}`);
  if (run.summary) lines.push(`- **Summary:** ${run.summary}`);
  const inputEntries = Object.entries(run.inputs);
  if (inputEntries.length > 0) {
    lines.push(`- **Inputs:** ${inputEntries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")}`);
  }
  return lines.join("\n");
}

function renderWorkflowRun(run: WorkflowRun): string {
  const lines: string[] = [];
  lines.push(`- **Status:** ${run.status}`);
  lines.push(`- **Started:** ${fmt(run.startedAt)}`);
  lines.push(`- **Finished:** ${fmt(run.finishedAt)}`);
  if (run.summary) lines.push(`- **Summary:** ${run.summary}`);
  const failed = run.records.filter((r) => r.status === "failed").length;
  if (failed > 0) lines.push(`- **Steps failed:** ${failed} of ${run.records.length}`);
  return lines.join("\n");
}

async function renderTaskMember(projectPath: string, member: ReportTaskMember): Promise<string> {
  const out: string[] = [`## Task: ${member.taskName}`];
  if (member.note) out.push(member.note);

  const runs: RunRecord[] =
    member.runIds.length > 0
      ? member.runIds.map((id) => getTaskRun(id)).filter((r): r is RunRecord => r !== null)
      : getRunHistory(projectPath, member.taskSlug, 1);

  if (runs.length === 0) {
    out.push("_No runs yet._");
  } else {
    for (const run of runs) out.push(renderTaskRun(run));
  }
  return out.join("\n\n");
}

async function renderWorkflowMember(projectPath: string, member: ReportWorkflowMember): Promise<string> {
  const out: string[] = [`## Workflow: ${member.workflowName}`];
  if (member.note) out.push(member.note);

  let runs: WorkflowRun[];
  if (member.runIds.length > 0) {
    const resolved = await Promise.all(member.runIds.map((id) => getWorkflowRun(projectPath, id)));
    runs = resolved.filter((r): r is WorkflowRun => r !== null);
  } else {
    const summaries = await listWorkflowRuns(projectPath, member.workflowId);
    const latest = summaries[0];
    const full = latest ? await getWorkflowRun(projectPath, latest.runId) : null;
    runs = full ? [full] : [];
  }

  if (runs.length === 0) {
    out.push("_No runs yet._");
  } else {
    for (const run of runs) out.push(renderWorkflowRun(run));
  }
  return out.join("\n\n");
}

async function renderFileMember(member: ReportFileMember): Promise<string> {
  const out: string[] = [`## File: ${member.name}`];
  if (member.note) out.push(member.note);
  out.push(`\`${member.uri}\``);

  try {
    const { getProvider } = await import("../vfs/registry");
    const scheme = member.uri.split("://")[0] ?? "";
    const provider = getProvider(scheme);
    if (provider) {
      const result = await provider.read(member.uri, PREVIEW_MAX_BYTES);
      if (!result.error && PREVIEW_MIME_PREFIXES.some((p) => result.mime.startsWith(p))) {
        const text = Buffer.from(result.data).toString("utf-8");
        if (text.trim()) out.push("```\n" + text + "\n```");
      }
    }
  } catch {
    /* best-effort preview only */
  }

  return out.join("\n\n");
}

/** Renders a report to Markdown. Pulls fresh data for every member — nothing is cached in the report itself. */
export async function generateReportMarkdown(projectPath: string, projectName: string, report: Report): Promise<string> {
  const sections: string[] = [];
  sections.push(`# ${report.name}`);
  sections.push(`_${projectName} — generated ${new Date().toLocaleString()}_`);
  if (report.description) sections.push(report.description);

  for (const member of report.members) {
    if (member.kind === "task") sections.push(await renderTaskMember(projectPath, member));
    else if (member.kind === "workflow") sections.push(await renderWorkflowMember(projectPath, member));
    else if (member.kind === "file") sections.push(await renderFileMember(member));
    else sections.push(member.text);
  }

  return sections.join("\n\n");
}

/** Renders and writes a report's Markdown to `<project>/reports/exports/`, returning the written path. */
export async function exportReportToFile(projectPath: string, projectName: string, report: Report): Promise<string> {
  const markdown = await generateReportMarkdown(projectPath, projectName, report);
  ensureDir(projectReportExportsDir(projectPath));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `${projectReportExportsDir(projectPath)}/${slugify(report.name)}-${stamp}.md`;
  await Bun.write(path, markdown);
  return path;
}
