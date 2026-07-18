/**
 * Task writer: translates in-memory "task" types to on-disk "form" vocabulary.
 * Companion to loader.ts — the disk format firewall (ticket 96).
 */

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
  };

  await Bun.write(join(dir, "meta.json"), JSON.stringify(fullMeta, null, 2));
  await Bun.write(join(dir, "form.json"), JSON.stringify(task, null, 2)); // Disk file still "form.json"

  return slug;
}

export { projectFormsDir, slugify };
