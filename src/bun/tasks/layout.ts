import { join } from "node:path";
import type { ProjectLayout } from "../../shared/types";
import { ensureProjectDirs, projectLayoutsDir } from "../paths";
import { slugify } from "./writer";

function layoutPath(projectPath: string, key: string): string {
  return join(projectLayoutsDir(projectPath), `${slugify(key) || "default"}.json`);
}

export async function readLayout(projectPath: string, key: string): Promise<ProjectLayout> {
  ensureProjectDirs(projectPath);
  try {
    const file = Bun.file(layoutPath(projectPath, key));
    if (!(await file.exists())) return { cards: [] };
    const parsed = JSON.parse(await file.text());
    if (parsed && Array.isArray(parsed.cards)) return parsed as ProjectLayout;
    return { cards: [] };
  } catch {
    return { cards: [] };
  }
}

export async function writeLayout(projectPath: string, key: string, layout: ProjectLayout): Promise<void> {
  ensureProjectDirs(projectPath);
  await Bun.write(layoutPath(projectPath, key), JSON.stringify(layout, null, 2));
}
