/**
 * Local filesystem provider (ticket 102): wraps a directory or single file
 * with glob search, stat, read (capped at 25MB), and native open/reveal.
 */

import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import type {
  VfsCapabilities,
  VfsListResult,
  VfsOpenResult,
  VfsProvider,
  VfsReadResult,
  VfsSearchResult,
  VfsStatResult,
} from "./provider";

const MAX_READ_BYTES = 25 * 1024 * 1024; // 25MB
const SEARCH_DEPTH_CAP = 6;
const SEARCH_COUNT_CAP = 2000;

/** Simple MIME inference from extension. */
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

/** Convert glob-style pattern to regex (simple * support only). */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const withWildcards = escaped.replace(/\*/g, ".*");
  return new RegExp(`^${withWildcards}$`, "i");
}

export class LocalProvider implements VfsProvider {
  readonly id = "local";
  readonly capabilities: VfsCapabilities = {
    watchable: true,
    writable: false,
    previewUrl: false,
  };

  /**
   * Extract the local absolute path from a local:// URI.
   * Rejects URIs that don't start with "local://".
   */
  private uriToPath(uri: string): string {
    if (!uri.startsWith("local://")) {
      throw new Error(`Invalid local URI: ${uri}`);
    }
    return uri.slice("local://".length);
  }

  /**
   * Convert a local absolute path to a local:// URI.
   */
  pathToUri(path: string): string {
    return `local://${path}`;
  }

  async list(uri: string): Promise<VfsListResult> {
    try {
      const dirPath = this.uriToPath(uri);
      const entries = await readdir(dirPath, { withFileTypes: true });
      const results: VfsStatResult[] = [];

      for (const entry of entries) {
        try {
          const fullPath = join(dirPath, entry.name);
          const stats = await stat(fullPath);
          results.push({
            name: entry.name,
            size: stats.size,
            mtime: stats.mtime.toISOString(),
            isDirectory: entry.isDirectory(),
          });
        } catch {
          // Skip entries that fail to stat (permissions, broken symlinks, etc.)
        }
      }

      return { entries: results };
    } catch (err) {
      return { entries: [], error: err instanceof Error ? err.message : String(err) };
    }
  }

  async stat(uri: string): Promise<VfsStatResult | null> {
    try {
      const path = this.uriToPath(uri);
      const stats = await stat(path);
      return {
        name: basename(path),
        size: stats.size,
        mtime: stats.mtime.toISOString(),
        isDirectory: stats.isDirectory(),
      };
    } catch {
      return null;
    }
  }

  async read(uri: string, maxBytes?: number): Promise<VfsReadResult> {
    try {
      const path = this.uriToPath(uri);
      const stats = await stat(path);

      if (stats.size > MAX_READ_BYTES) {
        return {
          data: new Uint8Array(),
          mime: "",
          error: `File exceeds 25MB cap (${Math.round(stats.size / 1024 / 1024)}MB)`,
        };
      }

      const effectiveMax = maxBytes && maxBytes < stats.size ? maxBytes : stats.size;
      const buffer = await readFile(path);
      const data = effectiveMax < buffer.length ? buffer.slice(0, effectiveMax) : buffer;

      return {
        data: new Uint8Array(data),
        mime: inferMime(path),
      };
    } catch (err) {
      return {
        data: new Uint8Array(),
        mime: "",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async search(rootUri: string, query: string): Promise<VfsSearchResult> {
    try {
      const rootPath = this.uriToPath(rootUri);
      const pattern = globToRegex(query);
      const matches: string[] = [];
      let truncated = false;

      const walk = async (dir: string, depth: number): Promise<void> => {
        if (depth > SEARCH_DEPTH_CAP || matches.length >= SEARCH_COUNT_CAP) {
          if (matches.length >= SEARCH_COUNT_CAP) truncated = true;
          return;
        }

        try {
          const entries = await readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (matches.length >= SEARCH_COUNT_CAP) {
              truncated = true;
              return;
            }

            const fullPath = join(dir, entry.name);
            const rel = relative(rootPath, fullPath);

            // Match against the relative path
            if (pattern.test(rel) || pattern.test(entry.name)) {
              matches.push(rel);
            }

            if (entry.isDirectory()) {
              await walk(fullPath, depth + 1);
            }
          }
        } catch {
          // Skip directories we can't read
        }
      };

      await walk(rootPath, 0);

      return { paths: matches, truncated };
    } catch (err) {
      return {
        paths: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async openNative(uri: string, reveal = false): Promise<VfsOpenResult> {
    try {
      const path = this.uriToPath(uri);
      await stat(path); // existence check — throws if missing

      if (process.platform === "darwin") {
        if (reveal) {
          // Reveal in Finder
          spawn("open", ["-R", path], { detached: true, stdio: "ignore" }).unref();
        } else {
          // Open with default app
          spawn("open", [path], { detached: true, stdio: "ignore" }).unref();
        }
      } else if (process.platform === "win32") {
        if (reveal) {
          spawn("explorer", ["/select,", path], { detached: true, stdio: "ignore" }).unref();
        } else {
          spawn("explorer", [path], { detached: true, stdio: "ignore" }).unref();
        }
      } else {
        // Linux/other: xdg-open for open, no reveal equivalent
        if (!reveal) {
          spawn("xdg-open", [path], { detached: true, stdio: "ignore" }).unref();
        } else {
          return { ok: false, error: "Reveal not supported on this platform" };
        }
      }

      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  watch(rootUri: string, callback: (paths: string[]) => void): () => void {
    const rootPath = this.uriToPath(rootUri);
    let debounceTimer: Timer | null = null;
    const pendingChanges = new Set<string>();

    const watcher = watch(rootPath, { recursive: true }, (_event, filename) => {
      if (filename) {
        pendingChanges.add(filename);
      }

      // Debounce: batch changes over 300ms
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const changes = Array.from(pendingChanges);
        pendingChanges.clear();
        callback(changes);
      }, 300);
    });

    return () => {
      watcher.close();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }
}
