import { join } from "node:path";
import type { ThreadView } from "../../shared/types";
import { ensureProjectDirs, projectFormsDir } from "../paths";

function viewsPath(projectPath: string): string {
  return join(projectFormsDir(projectPath), ".views.json");
}

function isThreadView(v: unknown): v is ThreadView {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.filters === "object" &&
    o.filters !== null &&
    !Array.isArray(o.filters)
  );
}

/** Read a project's saved thread views. Missing/corrupt file → empty list. */
export async function readViews(projectPath: string): Promise<ThreadView[]> {
  ensureProjectDirs(projectPath);
  try {
    const file = Bun.file(viewsPath(projectPath));
    if (!(await file.exists())) return [];
    const parsed = JSON.parse(await file.text());
    if (Array.isArray(parsed)) return parsed.filter(isThreadView);
    return [];
  } catch {
    return [];
  }
}

export async function writeViews(projectPath: string, views: ThreadView[]): Promise<void> {
  ensureProjectDirs(projectPath);
  await Bun.write(viewsPath(projectPath), JSON.stringify(views, null, 2));
}
