import { existsSync, mkdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

/**
 * App-scoped data directory. Holds the projects registry and any auto-created
 * (default) projects. This is NOT where a user's project data lives — each
 * project is its own folder on disk (see config.ts).
 *
 * When `CLIDE_PROFILE` is set (dev profiles, ticket 79), this resolves to an
 * isolated sibling directory instead of the real dev app-data — so seeding a
 * profile can never touch your actual projects/services/history.
 */
export function appDataDir(): string {
  const home = homedir();
  const profile = process.env.CLIDE_PROFILE?.trim();
  const appId = profile ? join("dev.clide-profiles", profile) : "dev.clide";
  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support", appId);
    case "win32":
      return join(process.env.LOCALAPPDATA ?? join(home, "AppData", "Local"), appId);
    default:
      return join(process.env.XDG_DATA_HOME ?? join(home, ".local", "share"), appId);
  }
}

/**
 * JSON file listing the absolute paths of the user's registered project
 * folders. A project's own config (name, etc.) lives inside the folder itself
 * at `.clide/config.json` (see config.ts), not here.
 */
export function projectsRegistryPath(): string {
  return join(appDataDir(), "projects.json");
}

/** JSON file storing global AI settings (e.g. Ollama base URL). Legacy — read only during one-time migration to `ai-services.json`. */
export function aiSettingsPath(): string {
  return join(appDataDir(), "ai-settings.json");
}

/** JSON file listing the user's configured AI services (ticket 45). */
export function aiServicesPath(): string {
  return join(appDataDir(), "ai-services.json");
}

/** Base directory under which auto-created projects (e.g. "Default") are stored. */
export function defaultProjectsDir(): string {
  return join(appDataDir(), "projects");
}

/**
 * Machine-global tool registry (ticket 53): one JSON file per registered CLI
 * tool. Global, not per-project — the same installed tool serves forms in
 * every project.
 */
export function toolsDir(): string {
  return join(appDataDir(), "tools");
}

export function toolEntryPath(id: string): string {
  return join(toolsDir(), `${id}.json`);
}

/** Where dropped-executable bytes are copied (ticket 55) — webviews don't expose real paths for dropped files. */
export function toolBinDir(): string {
  return join(toolsDir(), "bin");
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

/** Per-project config directory, kept inside the project folder itself. */
export function projectConfigDir(projectPath: string): string {
  return join(projectPath, ".clide");
}

/** JSON file holding a project's own config (display name, etc.). */
export function projectConfigPath(projectPath: string): string {
  return join(projectConfigDir(projectPath), "config.json");
}

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
    projectConfigDir(projectPath),
    projectFormsDir(projectPath),
    projectRunsDir(projectPath),
    projectLayoutsDir(projectPath),
  ]) {
    ensureDir(dir);
  }
}
