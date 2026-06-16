import { existsSync, rmSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import type { Project } from "../shared/types";
import { appDataDir, defaultProjectsDir, ensureDir, ensureProjectDirs, projectsRegistryPath } from "./paths";

let projects: Project[] = [];
let loaded = false;

function isValid(p: unknown): p is Project {
  return (
    typeof p === "object" &&
    p !== null &&
    typeof (p as Project).path === "string" &&
    typeof (p as Project).name === "string"
  );
}

function uniqueName(base: string, exclude?: string): string {
  let name = base || "Project";
  let i = 2;
  while (projects.some((p) => p.name === name && p.path !== exclude)) {
    name = `${base} (${i++})`;
  }
  return name;
}

async function save(): Promise<void> {
  ensureDir(appDataDir());
  await Bun.write(projectsRegistryPath(), JSON.stringify(projects, null, 2));
}

/** Load the projects registry from disk, dropping entries whose folders vanished. */
export async function loadProjects(): Promise<Project[]> {
  ensureDir(appDataDir());
  let list: Project[] = [];
  try {
    const file = Bun.file(projectsRegistryPath());
    if (await file.exists()) {
      const parsed = JSON.parse(await file.text());
      if (Array.isArray(parsed)) list = parsed.filter(isValid);
    }
  } catch {
    list = [];
  }

  const kept = list.filter((p) => existsSync(p.path));
  projects = kept;
  loaded = true;
  for (const p of projects) ensureProjectDirs(p.path);
  if (kept.length !== list.length) await save();
  return projects;
}

export async function listProjects(): Promise<Project[]> {
  if (!loaded) await loadProjects();
  return projects;
}

/**
 * Register a project. Either `path` (an absolute folder path) or `name` may be
 * given; when only a name is supplied the folder is created under the app's
 * default projects directory.
 */
export async function addProject(name: string, path?: string): Promise<Project> {
  if (!loaded) await loadProjects();

  const trimmedName = name.trim();
  let resolvedPath = path?.trim();
  if (resolvedPath && !isAbsolute(resolvedPath)) {
    throw new Error("Project path must be absolute.");
  }
  if (!resolvedPath) {
    const folderName = (trimmedName || "Project").replace(/[/\\]+/g, "-");
    resolvedPath = join(defaultProjectsDir(), folderName);
  }

  const existing = projects.find((p) => p.path === resolvedPath);
  if (existing) return existing;

  ensureProjectDirs(resolvedPath);
  const displayName = uniqueName(trimmedName || basename(resolvedPath));
  const project: Project = { path: resolvedPath, name: displayName };
  projects = [...projects, project];
  await save();
  return project;
}

export async function removeProject(path: string, deleteFiles = false): Promise<void> {
  if (!loaded) await loadProjects();
  projects = projects.filter((p) => p.path !== path);
  await save();
  if (deleteFiles) {
    try {
      rmSync(path, { recursive: true, force: true });
    } catch (err) {
      console.warn(`[projects] Failed to delete files for ${path}:`, err);
    }
  }
}

/** Rename a project's display name (the on-disk folder path is unchanged). */
export async function renameProject(path: string, newName: string): Promise<Project> {
  if (!loaded) await loadProjects();
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("Project name cannot be empty.");
  const target = projects.find((p) => p.path === path);
  if (!target) throw new Error("Project not found.");
  target.name = uniqueName(trimmed, path);
  projects = [...projects];
  await save();
  return target;
}

export async function resolveProjectByName(name: string): Promise<Project | null> {
  const list = await listProjects();
  return list.find((p) => p.name === name) ?? null;
}

export async function projectPaths(): Promise<string[]> {
  return (await listProjects()).map((p) => p.path);
}

/** Ensure at least one project exists, creating a "Default" project if none. */
export async function ensureDefaultProject(): Promise<Project> {
  const list = await loadProjects();
  if (list.length > 0) return list[0];
  return addProject("Default");
}
