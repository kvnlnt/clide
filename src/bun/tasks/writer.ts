/**
 * Task writer: translates in-memory "task" types to on-disk "form" vocabulary.
 * Companion to loader.ts — the disk format firewall (ticket 96).
 */

import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { TaskDefinition, TaskMeta } from "../../shared/types";
import { ensureDir, formDir, projectFormsDir } from "../paths";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Picks a free slug for a new task folder, de-duplicating against what's on disk. */
async function reserveSlug(projectPath: string, preferredSlug: string, name: string): Promise<string> {
  const base = preferredSlug ? slugify(preferredSlug) : slugify(name);
  let slug = base || `task-${Date.now()}`;
  let suffix = 1;
  while (await Bun.file(join(formDir(projectPath, slug), "meta.json")).exists()) {
    slug = `${base}-${suffix++}`;
  }
  return slug;
}

/**
 * Write a command-backed task (ticket 52/54): no script, no interpreter —
 * `task.command` points straight at an installed tool. Used by the task
 * creation wizard.
 */
export async function writeCommandTask(
  projectPath: string,
  meta: Omit<TaskMeta, "slug" | "createdAt" | "updatedAt"> & { slug?: string },
  task: TaskDefinition,
): Promise<string> {
  const slug = await reserveSlug(projectPath, meta.slug ?? "", meta.name);
  const dir = formDir(projectPath, slug); // Disk directory still under "forms/"
  ensureDir(dir);

  const now = new Date().toISOString();
  const fullMeta: TaskMeta = {
    ...meta,
    slug,
    createdAt: now,
    updatedAt: now,
    lifecycle: "draft",
    version: 1,
  };

  await Bun.write(join(dir, "meta.json"), JSON.stringify(fullMeta, null, 2));
  await Bun.write(join(dir, "form.json"), JSON.stringify(task, null, 2)); // Disk file still "form.json"

  return slug;
}

/**
 * Adopt a draft task (ticket 105): mark it as adopted and migrate it into the
 * versioned layout if not already there. Returns false if already adopted.
 */
export async function adoptTask(projectPath: string, slug: string, currentMeta: TaskMeta): Promise<boolean> {
  if (currentMeta.lifecycle === "adopted") return false;

  const dir = formDir(projectPath, slug);
  const v1Dir = join(dir, "versions", "1");

  // If versions/1/ doesn't exist, copy the root definition there (ticket 105 compat).
  if (!existsSync(join(v1Dir, "meta.json"))) {
    ensureDir(v1Dir);
    if (existsSync(join(dir, "form.json"))) {
      cpSync(join(dir, "form.json"), join(v1Dir, "form.json"));
    }
    if (existsSync(join(dir, "script.sh"))) {
      cpSync(join(dir, "script.sh"), join(v1Dir, "script.sh"));
    }
    if (existsSync(join(dir, "script.py"))) {
      cpSync(join(dir, "script.py"), join(v1Dir, "script.py"));
    }
    if (existsSync(join(dir, "browser.json"))) {
      cpSync(join(dir, "browser.json"), join(v1Dir, "browser.json"));
    }
  }

  // Mark as adopted in both root and version folder.
  const adoptedMeta: TaskMeta = { ...currentMeta, lifecycle: "adopted", updatedAt: new Date().toISOString() };
  await Bun.write(join(dir, "meta.json"), JSON.stringify(adoptedMeta, null, 2));
  await Bun.write(join(v1Dir, "meta.json"), JSON.stringify(adoptedMeta, null, 2));

  return true;
}

/**
 * Save a new version of an adopted task (ticket 105). Creates versions/N/
 * holding the complete definition. Returns the new version number.
 */
export async function saveTaskVersion(
  projectPath: string,
  slug: string,
  currentVersion: number,
  meta: Omit<TaskMeta, "slug" | "createdAt" | "updatedAt">,
  task: TaskDefinition,
  originalCreatedAt: string,
): Promise<number> {
  const newVersion = currentVersion + 1;
  const dir = formDir(projectPath, slug);
  const versionDir = join(dir, "versions", String(newVersion));
  ensureDir(versionDir);

  const now = new Date().toISOString();
  const versionMeta: TaskMeta = {
    ...meta,
    slug,
    createdAt: now,
    updatedAt: now,
    lifecycle: "draft", // New versions start as draft
    version: newVersion,
  };

  await Bun.write(join(versionDir, "meta.json"), JSON.stringify(versionMeta, null, 2));
  await Bun.write(join(versionDir, "form.json"), JSON.stringify(task, null, 2));

  // Copy browser.json if present (ticket 99 native tool config).
  if (existsSync(join(dir, "browser.json"))) {
    cpSync(join(dir, "browser.json"), join(versionDir, "browser.json"));
  }

  // Update root meta to point to latest version.
  const rootMeta: TaskMeta = {
    ...meta,
    slug,
    createdAt: originalCreatedAt,
    updatedAt: now,
    lifecycle: "draft",
    version: newVersion,
  };
  await Bun.write(join(dir, "meta.json"), JSON.stringify(rootMeta, null, 2));
  await Bun.write(join(dir, "form.json"), JSON.stringify(task, null, 2));

  return newVersion;
}

/**
 * Update only the cosmetic metadata (name, description, tags) of a task
 * (ticket 105). Works for both draft and adopted tasks — doesn't fork.
 */
export async function updateTaskMeta(
  projectPath: string,
  slug: string,
  currentMeta: TaskMeta,
  patch: { name?: string; description?: string; tags?: string[] },
): Promise<void> {
  const dir = formDir(projectPath, slug);
  const updated: TaskMeta = {
    ...currentMeta,
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.description !== undefined && { description: patch.description }),
    ...(patch.tags !== undefined && { tags: patch.tags }),
    updatedAt: new Date().toISOString(),
  };
  await Bun.write(join(dir, "meta.json"), JSON.stringify(updated, null, 2));
}

export { projectFormsDir, slugify };
