/**
 * Report store (ticket 134): one human-readable JSON file per report at
 * `<project>/reports/<slug>.json`. Unlike workflows/store.ts there's no
 * legacy disk format to translate — Report is a brand-new entity, so the
 * in-memory shape is the disk shape verbatim.
 */

import { readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { Report, ReportMember } from "../../shared/types";
import { ensureDir, projectReportsDir, reportPath } from "../paths";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateMembers(raw: unknown): ReportMember[] {
  if (!Array.isArray(raw)) return [];
  const out: ReportMember[] = [];
  for (const item of raw) {
    if (!isObject(item) || typeof item.id !== "string") continue;
    const note = typeof item.note === "string" ? item.note : undefined;
    switch (item.kind) {
      case "task":
        if (typeof item.taskSlug !== "string") continue;
        out.push({
          kind: "task",
          id: item.id,
          note,
          taskSlug: item.taskSlug,
          taskName: typeof item.taskName === "string" ? item.taskName : item.taskSlug,
          runIds: Array.isArray(item.runIds) ? item.runIds.filter((r): r is string => typeof r === "string") : [],
        });
        break;
      case "workflow":
        if (typeof item.workflowId !== "string") continue;
        out.push({
          kind: "workflow",
          id: item.id,
          note,
          workflowId: item.workflowId,
          workflowName: typeof item.workflowName === "string" ? item.workflowName : item.workflowId,
          runIds: Array.isArray(item.runIds) ? item.runIds.filter((r): r is string => typeof r === "string") : [],
        });
        break;
      case "file":
        if (typeof item.uri !== "string") continue;
        out.push({
          kind: "file",
          id: item.id,
          note,
          uri: item.uri,
          name: typeof item.name === "string" ? item.name : item.uri,
        });
        break;
      case "note":
        out.push({ kind: "note", id: item.id, note, text: typeof item.text === "string" ? item.text : "" });
        break;
      default:
        continue;
    }
  }
  return out;
}

function validateReport(raw: unknown): Report | null {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  return {
    id: raw.id,
    name: raw.name,
    description: typeof raw.description === "string" ? raw.description : "",
    members: validateMembers(raw.members),
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
      .slice(0, 64) || "report"
  );
}

/** All valid reports in a project, alphabetically. Malformed files are skipped with a warning. */
export async function listReports(projectPath: string): Promise<Report[]> {
  ensureDir(projectReportsDir(projectPath));
  let files: string[];
  try {
    files = readdirSync(projectReportsDir(projectPath));
  } catch {
    return [];
  }
  const out: Report[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(await Bun.file(join(projectReportsDir(projectPath), file)).text());
      const report = validateReport(raw);
      if (report) out.push(report);
      else console.warn(`[reports] Skipping malformed report file: ${file}`);
    } catch {
      console.warn(`[reports] Skipping unreadable report file: ${file}`);
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export async function getReport(projectPath: string, id: string): Promise<Report | null> {
  return (await listReports(projectPath)).find((r) => r.id === id) ?? null;
}

/** Model-level validation on save: an empty name breaks the list/file-naming, so it's rejected here. */
export function validateForSave(report: Report): string | null {
  if (!report.name.trim()) return "Report name is required.";
  return null;
}

/** Writes a report to `<project>/reports/<slug>.json`, maintaining timestamps. */
export async function saveReport(projectPath: string, report: Report): Promise<void> {
  ensureDir(projectReportsDir(projectPath));
  const now = new Date().toISOString();
  const next: Report = { ...report, updatedAt: now, createdAt: report.createdAt || now };

  // Filename follows the name; a rename moves the file (id is identity).
  const existing = await listReports(projectPath);
  const prior = existing.find((r) => r.id === report.id);
  if (prior && slugify(prior.name) !== slugify(next.name)) {
    try {
      unlinkSync(reportPath(projectPath, slugify(prior.name)));
    } catch {
      /* already gone */
    }
  }
  // Avoid slug collisions between two differently-id'd reports.
  let slug = slugify(next.name);
  if (existing.some((r) => r.id !== next.id && slugify(r.name) === slug)) slug = `${slug}-${next.id.slice(0, 8)}`;

  await Bun.write(reportPath(projectPath, slug), JSON.stringify(next, null, 2));
}

export async function deleteReport(projectPath: string, id: string): Promise<void> {
  ensureDir(projectReportsDir(projectPath));
  let files: string[];
  try {
    files = readdirSync(projectReportsDir(projectPath));
  } catch {
    return;
  }
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(await Bun.file(join(projectReportsDir(projectPath), file)).text());
      if (isObject(raw) && raw.id === id) unlinkSync(join(projectReportsDir(projectPath), file));
    } catch {
      /* skip unreadable */
    }
  }
}
