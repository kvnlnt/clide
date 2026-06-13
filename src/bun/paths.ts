import { existsSync, mkdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

/**
 * App-scoped data directory. Holds the projects registry and any auto-created
 * (default) projects. This is NOT where a user's project data lives — each
 * project is its own folder on disk (see config.ts).
 */
export function appDataDir(): string {
  const home = homedir();
  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support", "dev.clide");
    case "win32":
      return join(process.env.LOCALAPPDATA ?? join(home, "AppData", "Local"), "dev.clide");
    default:
      return join(process.env.XDG_DATA_HOME ?? join(home, ".local", "share"), "dev.clide");
  }
}

/** JSON file listing the user's registered project folders. */
export function projectsRegistryPath(): string {
  return join(appDataDir(), "projects.json");
}

/** Base directory under which auto-created projects (e.g. "Default") are stored. */
export function defaultProjectsDir(): string {
  return join(appDataDir(), "projects");
}

/**
 * Create a directory, tolerating EEXIST which some Bun versions throw even with
 * `recursive: true`.
 */
export function ensureDir(dir: string): void {
  if (existsSync(dir)) return;
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }
}

// ---------------------------------------------------------------------------
// Per-project paths. A project is a folder on disk that houses all of its forms,
// run history, and outputs.
// ---------------------------------------------------------------------------

export function projectFormsDir(projectPath: string): string {
  return join(projectPath, "forms");
}

export function projectRunsDir(projectPath: string): string {
  return join(projectPath, "runs");
}

export function projectLayoutsDir(projectPath: string): string {
  return join(projectPath, "forms", ".layouts");
}

export function projectHistoryDb(projectPath: string): string {
  return join(projectPath, "history.db");
}

export function formDir(projectPath: string, slug: string): string {
  return join(projectFormsDir(projectPath), slug);
}

export function runDir(projectPath: string, runId: string): string {
  return join(projectRunsDir(projectPath), runId);
}

/** Ensure a project's directory structure exists. Safe to call repeatedly. */
export function ensureProjectDirs(projectPath: string): void {
  for (const dir of [
    projectPath,
    projectFormsDir(projectPath),
    projectRunsDir(projectPath),
    projectLayoutsDir(projectPath),
  ]) {
    ensureDir(dir);
  }
}
