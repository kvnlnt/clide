import { existsSync, rmSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import type { Project } from "../shared/types";
import {
  appDataDir,
  defaultProjectsDir,
  ensureDir,
  ensureProjectDirs,
  projectConfigDir,
  projectConfigPath,
  projectsRegistryPath,
} from "./paths";

/**
 * A project's own config, stored inside the project folder at
 * `<project>/.clide/config.json`. The global registry only tracks which folders
 * are projects; everything user-editable about a project lives here.
 */
interface ProjectConfig {
  name: string;
  /** Whether to track unread results (ticket 97). Defaults to true. */
  trackUnread?: boolean;
}

/** In-memory registry: absolute paths of the user's project folders. */
let projectPathsList: string[] = [];
let loaded = false;

function uniqueName(base: string, names: string[], exclude?: string): string {
  const taken = new Set(names);
  if (exclude) taken.delete(exclude);
  let name = base || "Project";
  let i = 2;
  while (taken.has(name)) name = `${base} (${i++})`;
  return name;
}

// ---------------------------------------------------------------------------
// Per-project config (lives inside the project folder).
// ---------------------------------------------------------------------------

async function readProjectConfig(path: string): Promise<ProjectConfig> {
  try {
    const file = Bun.file(projectConfigPath(path));
    if (await file.exists()) {
      const parsed = JSON.parse(await file.text());
      if (parsed && typeof parsed.name === "string") {
        return { ...parsed, name: parsed.name };
      }
    }
  } catch {
    // fall through to default
  }
  return { name: basename(path) };
}

async function writeProjectConfig(path: string, config: ProjectConfig): Promise<void> {
  ensureDir(projectConfigDir(path));
  await Bun.write(projectConfigPath(path), JSON.stringify(config, null, 2));
}

// ---------------------------------------------------------------------------
// Global registry (just the set of project folder paths).
// ---------------------------------------------------------------------------

async function saveRegistry(): Promise<void> {
  ensureDir(appDataDir());
  await Bun.write(projectsRegistryPath(), JSON.stringify(projectPathsList, null, 2));
}

/**
 * Parse the registry file. Supports both the current format (an array of path
 * strings) and the legacy format (an array of `{ path, name }` objects), so old
 * installs migrate transparently. Returns the paths plus any legacy names that
 * should be seeded into per-project configs.
 */
function parseRegistry(parsed: unknown): { paths: string[]; legacyNames: Map<string, string> } {
  const paths: string[] = [];
  const legacyNames = new Map<string, string>();
  if (!Array.isArray(parsed)) return { paths, legacyNames };
  for (const entry of parsed) {
    if (typeof entry === "string") {
      paths.push(entry);
    } else if (entry && typeof entry === "object" && typeof (entry as Project).path === "string") {
      const e = entry as Project;
      paths.push(e.path);
      if (typeof e.name === "string" && e.name.trim()) legacyNames.set(e.path, e.name);
    }
  }
  return { paths, legacyNames };
}

/** Load the projects registry from disk, dropping entries whose folders vanished. */
export async function loadProjects(): Promise<Project[]> {
  ensureDir(appDataDir());
  let paths: string[] = [];
  let legacyNames = new Map<string, string>();
  try {
    const file = Bun.file(projectsRegistryPath());
    if (await file.exists()) {
      ({ paths, legacyNames } = parseRegistry(JSON.parse(await file.text())));
    }
  } catch {
    paths = [];
  }

  // Drop missing folders and de-duplicate while preserving order.
  const seen = new Set<string>();
  const kept = paths.filter((p) => {
    if (seen.has(p) || !existsSync(p)) return false;
    seen.add(p);
    return true;
  });

  projectPathsList = kept;
  loaded = true;

  for (const p of kept) {
    ensureProjectDirs(p);
    // Migrate a legacy name into the project's own config if it has none yet.
    const legacy = legacyNames.get(p);
    if (legacy && !(await Bun.file(projectConfigPath(p)).exists())) {
      await writeProjectConfig(p, { name: legacy });
    }
  }

  if (kept.length !== paths.length || legacyNames.size > 0) await saveRegistry();
  return resolveProjects();
}

/** Build Project records by reading each registered folder's own config. */
async function resolveProjects(): Promise<Project[]> {
  const out: Project[] = [];
  for (const path of projectPathsList) {
    const config = await readProjectConfig(path);
    out.push({ path, name: config.name });
  }
  return out;
}

export async function listProjects(): Promise<Project[]> {
  if (!loaded) return loadProjects();
  return resolveProjects();
}

/**
 * Register a project. Either `path` (an absolute folder path) or `name` may be
 * given; when only a name is supplied the folder is created under the app's
 * default projects directory. The display name is persisted in the project's
 * own `.clide/config.json`.
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

  ensureProjectDirs(resolvedPath);

  const existing = projectPathsList.includes(resolvedPath);
  if (!existing) {
    projectPathsList = [...projectPathsList, resolvedPath];
    await saveRegistry();
  }

  // Determine a display name, unique across other projects.
  const others = (await resolveProjects())
    .filter((p) => p.path !== resolvedPath)
    .map((p) => p.name);
  if (existing) {
    const current = await readProjectConfig(resolvedPath);
    return { path: resolvedPath, name: current.name };
  }
  const displayName = uniqueName(trimmedName || basename(resolvedPath), others);
  await writeProjectConfig(resolvedPath, { name: displayName });
  return { path: resolvedPath, name: displayName };
}

export async function removeProject(path: string, deleteFiles = false): Promise<void> {
  if (!loaded) await loadProjects();
  projectPathsList = projectPathsList.filter((p) => p !== path);
  await saveRegistry();
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
  if (!projectPathsList.includes(path)) throw new Error("Project not found.");
  const others = (await resolveProjects())
    .filter((p) => p.path !== path)
    .map((p) => p.name);
  const name = uniqueName(trimmed, others);
  const config = await readProjectConfig(path);
  await writeProjectConfig(path, { ...config, name });
  return { path, name };
}

export async function resolveProjectByName(name: string): Promise<Project | null> {
  const list = await listProjects();
  return list.find((p) => p.name === name) ?? null;
}

export async function projectPaths(): Promise<string[]> {
  if (!loaded) await loadProjects();
  return [...projectPathsList];
}

/** Ensure at least one project exists, creating a "Default" project if none. */
export async function ensureDefaultProject(): Promise<Project> {
  const list = await loadProjects();
  if (list.length > 0) return list[0];
  return addProject("Default");
}

/** Get the trackUnread flag for a project (ticket 97). Defaults to true. */
export async function getTrackUnread(path: string): Promise<boolean> {
  const config = await readProjectConfig(path);
  return config.trackUnread ?? true;
}

/** Set the trackUnread flag for a project (ticket 97). */
export async function setTrackUnread(path: string, trackUnread: boolean): Promise<void> {
  const config = await readProjectConfig(path);
  await writeProjectConfig(path, { ...config, trackUnread });
}
