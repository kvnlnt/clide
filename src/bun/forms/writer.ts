import { join } from "node:path";
import type { FormDefinition, FormMeta, GeneratedForm } from "../../shared/types";
import { ensureDir, formDir, projectFormsDir } from "../paths";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Picks a free slug for a new form folder, de-duplicating against what's on disk. */
async function reserveSlug(projectPath: string, preferredSlug: string, name: string): Promise<string> {
  const base = preferredSlug ? slugify(preferredSlug) : slugify(name);
  let slug = base || `form-${Date.now()}`;
  let suffix = 1;
  while (await Bun.file(join(formDir(projectPath, slug), "meta.json")).exists()) {
    slug = `${base}-${suffix++}`;
  }
  return slug;
}

/**
 * Write a generated form to disk inside a project folder as a self-contained
 * folder. Returns the slug actually used (de-duplicated if a folder exists).
 */
export async function writeForm(projectPath: string, generated: GeneratedForm): Promise<string> {
  const slug = await reserveSlug(projectPath, generated.meta.slug, generated.meta.name);
  const dir = formDir(projectPath, slug);
  ensureDir(dir);

  const ext = generated.scriptExtension?.replace(/^\./, "") || "sh";
  const scriptFile = `script.${ext}`;
  const now = new Date().toISOString();

  const meta = {
    ...generated.meta,
    slug,
    createdAt: generated.meta.createdAt || now,
    updatedAt: now,
  };
  const form = { ...generated.form, scriptFile };

  await Bun.write(join(dir, "meta.json"), JSON.stringify(meta, null, 2));
  await Bun.write(join(dir, "form.json"), JSON.stringify(form, null, 2));
  await Bun.write(join(dir, scriptFile), generated.script);

  // Make script executable (best-effort).
  try {
    await Bun.spawn(["chmod", "+x", join(dir, scriptFile)]).exited;
  } catch {
    /* non-fatal */
  }

  return slug;
}

/**
 * Write a command-backed form (ticket 52/54): no script, no interpreter —
 * `form.command` points straight at an installed tool. Used by the form
 * creation wizard.
 */
export async function writeCommandForm(
  projectPath: string,
  meta: Omit<FormMeta, "slug" | "createdAt" | "updatedAt"> & { slug?: string },
  form: FormDefinition,
): Promise<string> {
  const slug = await reserveSlug(projectPath, meta.slug ?? "", meta.name);
  const dir = formDir(projectPath, slug);
  ensureDir(dir);

  const now = new Date().toISOString();
  const fullMeta: FormMeta = {
    ...meta,
    slug,
    createdAt: now,
    updatedAt: now,
  };

  await Bun.write(join(dir, "meta.json"), JSON.stringify(fullMeta, null, 2));
  await Bun.write(join(dir, "form.json"), JSON.stringify(form, null, 2));

  return slug;
}

export { projectFormsDir, slugify };
