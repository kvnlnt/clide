/**
 * Run artifact detection (ticket 102): two channels for discovering files a
 * run touched — declared (from output definitions) + observed (snapshot diff).
 */

import { existsSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import type { OutputResult, RunArtifact, TaskFolder } from "../../shared/types";

const SNAPSHOT_DEPTH_CAP = 6;
const SNAPSHOT_COUNT_CAP = 2000;

interface FileSnapshot {
  path: string;
  mtime: number;
  size: number;
}

/**
 * Recursively snapshot a directory: relative path + mtime/size for each file.
 * Bounded by depth and count caps to avoid performance issues.
 */
async function snapshotDir(root: string, depth = 0): Promise<FileSnapshot[]> {
  if (depth > SNAPSHOT_DEPTH_CAP) return [];

  const files: FileSnapshot[] = [];
  try {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= SNAPSHOT_COUNT_CAP) break;

      const fullPath = join(root, entry.name);
      try {
        if (entry.isDirectory()) {
          const subFiles = await snapshotDir(fullPath, depth + 1);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          const stats = statSync(fullPath);
          files.push({
            path: fullPath,
            mtime: stats.mtimeMs,
            size: stats.size,
          });
        }
      } catch {
        // Skip entries we can't stat (permissions, etc.)
      }

      if (files.length >= SNAPSHOT_COUNT_CAP) break;
    }
  } catch {
    // Skip directories we can't read
  }

  return files;
}

/**
 * Snapshot all files in locations associated with this task. Returns a map
 * of location root → file snapshots. Logs a notice if any location exceeds caps.
 */
export async function snapshotAssociatedLocations(
  folder: TaskFolder,
  emitNotice: (msg: string) => void,
): Promise<Map<string, FileSnapshot[]>> {
  const snapshots = new Map<string, FileSnapshot[]>();

  if (!folder.task.fileAssociations || folder.task.fileAssociations.length === 0) {
    return snapshots;
  }

  const { getLocation } = await import("../vfs/registry");

  for (const assoc of folder.task.fileAssociations) {
    try {
      const location = await getLocation(assoc.locationId, folder.projectPath);
      if (!location) continue;
      if (location.provider !== "local") continue; // Only local for now

      const root = location.config.root as string;
      if (!existsSync(root)) continue;

      const files = await snapshotDir(root);
      if (files.length >= SNAPSHOT_COUNT_CAP) {
        emitNotice(
          `⚠ Location "${location.name}" exceeds ${SNAPSHOT_COUNT_CAP} files — observed artifact detection skipped.`,
        );
        continue;
      }

      snapshots.set(root, files);
    } catch (err) {
      console.warn(`[artifacts] Failed to snapshot location ${assoc.locationId}:`, err);
    }
  }

  return snapshots;
}

/**
 * Diff before/after snapshots to find created, modified, and deleted files
 * within an association's optional glob pattern. Returns RunArtifacts with
 * source="observed".
 */
export async function diffSnapshots(
  runId: string,
  folder: TaskFolder,
  before: Map<string, FileSnapshot[]>,
): Promise<RunArtifact[]> {
  const artifacts: RunArtifact[] = [];

  if (!folder.task.fileAssociations || folder.task.fileAssociations.length === 0) {
    return artifacts;
  }

  const { getLocation } = await import("../vfs/registry");
  const { LocalProvider } = await import("../vfs/local");
  const localProvider = new LocalProvider();

  for (const assoc of folder.task.fileAssociations) {
    try {
      const location = await getLocation(assoc.locationId, folder.projectPath);
      if (!location) continue;
      if (location.provider !== "local") continue;

      const root = location.config.root as string;
      const beforeFiles = before.get(root);
      if (!beforeFiles) continue; // Location was skipped during pre-snapshot

      // Take a fresh snapshot
      const afterFiles = await snapshotDir(root);

      // Build maps for easier lookup
      const beforeMap = new Map(beforeFiles.map((f) => [f.path, f]));
      const afterMap = new Map(afterFiles.map((f) => [f.path, f]));

      // Pattern matching helper
      const matchesPattern = (relativePath: string): boolean => {
        if (!assoc.pattern) return true;
        const regex = new RegExp("^" + assoc.pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i");
        return regex.test(relativePath);
      };

      // Detect created and modified
      for (const [path, after] of afterMap) {
        const rel = relative(root, path);
        if (!matchesPattern(rel)) continue;

        const before = beforeMap.get(path);
        let kind: RunArtifact["kind"];

        if (!before) {
          kind = "created";
        } else if (before.mtime !== after.mtime || before.size !== after.size) {
          kind = "modified";
        } else {
          continue; // Unchanged
        }

        const uri = localProvider.pathToUri(path);
        const mime = inferMime(path);

        artifacts.push({
          runId,
          uri,
          name: basename(path),
          kind,
          size: after.size,
          mime,
          source: "observed",
        });
      }

      // Detect deleted
      for (const [path, _before] of beforeMap) {
        if (afterMap.has(path)) continue; // Still exists
        const rel = relative(root, path);
        if (!matchesPattern(rel)) continue;

        const uri = localProvider.pathToUri(path);

        artifacts.push({
          runId,
          uri,
          name: basename(path),
          kind: "deleted",
          source: "observed",
        });
      }
    } catch (err) {
      console.warn(`[artifacts] Failed to diff location ${assoc.locationId}:`, err);
    }
  }

  return artifacts;
}

/** Infer MIME type from file extension. */
function inferMime(path: string): string {
  const ext = extname(path).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".txt": "text/plain",
    ".json": "application/json",
    ".md": "text/markdown",
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".ts": "application/typescript",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
  };
  return mimeMap[ext] ?? "application/octet-stream";
}

/**
 * Extract declared artifacts from output definitions: any output whose value
 * is a path-like string that resolves to an existing file (ticket 102).
 */
export function extractDeclaredArtifacts(runId: string, outputs: OutputResult[]): RunArtifact[] {
  const artifacts: RunArtifact[] = [];
  const { LocalProvider } = require("../vfs/local");
  const localProvider = new LocalProvider();

  for (const output of outputs) {
    if (!output.ok || typeof output.value !== "string") continue;

    const value = output.value.trim();
    // Check if it looks like an absolute path and exists
    if (value.startsWith("/") && existsSync(value)) {
      try {
        const stats = statSync(value);
        if (stats.isFile()) {
          const uri = localProvider.pathToUri(value);
          const mime = inferMime(value);

          artifacts.push({
            runId,
            uri,
            name: basename(value),
            kind: "created", // Assume created for declared artifacts
            size: stats.size,
            mime,
            source: "declared",
          });
        }
      } catch {
        // Not a valid file
      }
    }
  }

  return artifacts;
}
