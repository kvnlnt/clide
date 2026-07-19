/**
 * VFS location registry (ticket 102): CRUD for app-scoped and project-scoped
 * file locations. App-scoped locations persist in app-data/vfs.json;
 * project-scoped in <projectPath>/vfs.json.
 */

import { existsSync } from "node:fs";
import { mkdir, realpath } from "node:fs/promises";
import { dirname, join, normalize, resolve as pathResolve, relative } from "node:path";
import { appDataDir } from "../paths";
import { DropboxProvider } from "./dropbox";
import { GDriveProvider } from "./gdrive";
import { LocalProvider } from "./local";
import type { VfsProvider } from "./provider";

export type VfsLocationScope = "app" | "project";

export interface VfsLocation {
  id: string;
  name: string;
  /** Provider id: "local", "dropbox", "gdrive", etc. */
  provider: string;
  /** Provider-specific config, e.g. { root: "/Users/..." } for local. */
  config: Record<string, unknown>;
  /** App-scoped = global, project-scoped = tied to one project. */
  scope: VfsLocationScope;
  /** Project path when scope === "project"; undefined otherwise. */
  project?: string;
  /** Opt-in fs watching (off by default to avoid watcher storms). */
  watch?: boolean;
}

/** Registry of all available providers. */
const providers = new Map<string, VfsProvider>([
  ["local", new LocalProvider()],
  ["dropbox", new DropboxProvider()],
  ["gdrive", new GDriveProvider()],
]);

export function getProvider(id: string): VfsProvider | null {
  return providers.get(id) ?? null;
}

export function listProviders(): VfsProvider[] {
  return Array.from(providers.values());
}

/** App-scoped locations file. */
function appLocationsPath(): string {
  return join(appDataDir(), "vfs.json");
}

/** Project-scoped locations file. */
function projectLocationsPath(projectPath: string): string {
  return join(projectPath, "vfs.json");
}

/** Ensure the directory for a JSON file exists. */
async function ensureDir(path: string): Promise<void> {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/** Load locations from a JSON file. Corrupt/missing → []. */
async function loadLocations(path: string): Promise<VfsLocation[]> {
  try {
    const file = Bun.file(path);
    if (!(await file.exists())) return [];
    const parsed = JSON.parse(await file.text());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Save locations to a JSON file. */
async function saveLocations(path: string, locations: VfsLocation[]): Promise<void> {
  await ensureDir(path);
  await Bun.write(path, JSON.stringify(locations, null, 2));
}

/** List all app-scoped locations. */
export async function listAppLocations(): Promise<VfsLocation[]> {
  return loadLocations(appLocationsPath());
}

/** List all project-scoped locations for a project. */
export async function listProjectLocations(projectPath: string): Promise<VfsLocation[]> {
  return loadLocations(projectLocationsPath(projectPath));
}

/** Get a specific location by id (checks both scopes). */
export async function getLocation(id: string, projectPath?: string): Promise<VfsLocation | null> {
  const appLocs = await listAppLocations();
  const found = appLocs.find((loc) => loc.id === id);
  if (found) return found;

  if (projectPath) {
    const projLocs = await listProjectLocations(projectPath);
    return projLocs.find((loc) => loc.id === id) ?? null;
  }

  return null;
}

/** Add a new location (app-scoped or project-scoped). */
export async function addLocation(location: VfsLocation): Promise<void> {
  if (location.scope === "app") {
    const locations = await listAppLocations();
    locations.push(location);
    await saveLocations(appLocationsPath(), locations);
  } else {
    if (!location.project) throw new Error("Project path required for project-scoped location");
    const locations = await listProjectLocations(location.project);
    locations.push(location);
    await saveLocations(projectLocationsPath(location.project), locations);
  }
}

/** Update an existing location. */
export async function updateLocation(location: VfsLocation): Promise<void> {
  if (location.scope === "app") {
    const locations = await listAppLocations();
    const idx = locations.findIndex((loc) => loc.id === location.id);
    if (idx === -1) throw new Error(`Location not found: ${location.id}`);
    locations[idx] = location;
    await saveLocations(appLocationsPath(), locations);
  } else {
    if (!location.project) throw new Error("Project path required for project-scoped location");
    const locations = await listProjectLocations(location.project);
    const idx = locations.findIndex((loc) => loc.id === location.id);
    if (idx === -1) throw new Error(`Location not found: ${location.id}`);
    locations[idx] = location;
    await saveLocations(projectLocationsPath(location.project), locations);
  }
}

/** Remove a location by id. */
export async function removeLocation(id: string, projectPath?: string): Promise<void> {
  // Try app scope first
  const appLocs = await listAppLocations();
  const appIdx = appLocs.findIndex((loc) => loc.id === id);
  if (appIdx !== -1) {
    appLocs.splice(appIdx, 1);
    await saveLocations(appLocationsPath(), appLocs);
    return;
  }

  // Try project scope
  if (projectPath) {
    const projLocs = await listProjectLocations(projectPath);
    const projIdx = projLocs.findIndex((loc) => loc.id === id);
    if (projIdx !== -1) {
      projLocs.splice(projIdx, 1);
      await saveLocations(projectLocationsPath(projectPath), projLocs);
      return;
    }
  }

  throw new Error(`Location not found: ${id}`);
}

/**
 * Security: resolve a location + relative path to an absolute path, ensuring
 * it stays within the location's root. Rejects ".." traversal and symlink
 * escapes by normalizing, resolving symlinks, and checking prefix containment.
 */
export async function resolveSafe(location: VfsLocation, relativePath: string): Promise<string | null> {
  if (location.provider !== "local") {
    // Remote providers handle their own URIs
    return null;
  }

  const root = location.config.root as string | undefined;
  if (!root) return null;

  // Normalize and resolve the root
  let realRoot: string;
  try {
    realRoot = await realpath(root);
  } catch {
    // Root doesn't exist or isn't accessible
    return null;
  }

  // Build the candidate path
  const normalized = normalize(relativePath);
  const candidate = pathResolve(realRoot, normalized);

  // Resolve symlinks in the candidate
  let realCandidate: string;
  try {
    realCandidate = await realpath(candidate);
  } catch {
    // Path doesn't exist yet (e.g., checking before creation) — verify the prefix directly
    realCandidate = candidate;
  }

  // Ensure the candidate is within the root (prefix check)
  const rel = relative(realRoot, realCandidate);
  if (rel.startsWith("..") || pathResolve(realRoot, rel) !== realCandidate) {
    // Escape attempt
    return null;
  }

  return realCandidate;
}
