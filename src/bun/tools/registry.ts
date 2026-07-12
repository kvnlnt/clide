import { createHash } from "node:crypto";
import { chmodSync, readdirSync, realpathSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { ToolRegistryEntry } from "../../shared/types";
import { ensureDir, toolBinDir, toolEntryPath, toolsDir } from "../paths";

function isEntry(raw: unknown): raw is ToolRegistryEntry {
  return (
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as ToolRegistryEntry).id === "string" &&
    typeof (raw as ToolRegistryEntry).name === "string" &&
    typeof (raw as ToolRegistryEntry).execPath === "string"
  );
}

/** All registered tools, alphabetically by name. Missing/malformed entries are skipped. */
export async function listTools(): Promise<ToolRegistryEntry[]> {
  ensureDir(toolsDir());
  let files: string[];
  try {
    files = readdirSync(toolsDir());
  } catch {
    return [];
  }
  const entries: ToolRegistryEntry[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(await Bun.file(`${toolsDir()}/${file}`).text());
      if (isEntry(raw)) entries.push(raw);
    } catch {
      // skip malformed entry
    }
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

export async function getTool(id: string): Promise<ToolRegistryEntry | null> {
  try {
    const raw = JSON.parse(await Bun.file(toolEntryPath(id)).text());
    return isEntry(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Finds an existing entry pointing at the same real (deduped) executable path, if any. */
export async function findByRealPath(execPath: string): Promise<ToolRegistryEntry | null> {
  let real: string;
  try {
    real = realpathSync(execPath);
  } catch {
    real = execPath;
  }
  const all = await listTools();
  return all.find((t) => t.execPath === real) ?? null;
}

export async function saveTool(entry: ToolRegistryEntry): Promise<void> {
  ensureDir(toolsDir());
  await Bun.write(toolEntryPath(entry.id), JSON.stringify(entry, null, 2));
}

export function removeTool(id: string): void {
  try {
    unlinkSync(toolEntryPath(id));
  } catch {
    /* already gone */
  }
}

/** Finds an existing dropped-in (`custom`) entry with identical bytes, so re-drops don't pile up duplicate copies. */
export async function findByHash(hash: string): Promise<ToolRegistryEntry | null> {
  const all = await listTools();
  return all.find((t) => t.source === "custom" && t.sourceHash === hash) ?? null;
}

function safeBaseName(fileName: string): string {
  const base = fileName.split("/").pop() ?? fileName;
  return base.replace(/[^a-zA-Z0-9._-]/g, "_") || "tool";
}

/**
 * Copies dropped-executable bytes into CLIDE's own storage and marks it
 * executable (ticket 55). Webviews don't expose the real filesystem path of
 * a dropped file, so this sidesteps that entirely — the copy IS the tool.
 * Best-effort strips macOS quarantine so Gatekeeper doesn't silently block
 * the first run.
 */
export async function storeDroppedBinary(fileName: string, bytes: Uint8Array): Promise<{ execPath: string; hash: string }> {
  ensureDir(toolBinDir());
  const hash = createHash("sha256").update(bytes).digest("hex");
  const execPath = join(toolBinDir(), `${crypto.randomUUID()}-${safeBaseName(fileName)}`);
  await Bun.write(execPath, bytes);
  try {
    chmodSync(execPath, 0o755);
  } catch {
    /* best-effort */
  }
  try {
    await Bun.spawn(["xattr", "-d", "com.apple.quarantine", execPath], { stderr: "ignore" }).exited;
  } catch {
    /* not macOS, or no quarantine attribute — fine either way */
  }
  return { execPath, hash };
}
