import { join } from "node:path";
import type { GeneratedForm } from "../../shared/types";
import { ensureDir, formDir, projectFormsDir } from "../paths";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/**
 * Write a generated form to disk inside a project folder as a self-contained
 * folder. Returns the slug actually used (de-duplicated if a folder exists).
 */
export async function writeForm(projectPath: string, generated: GeneratedForm): Promise<string> {
  const base = generated.meta.slug ? slugify(generated.meta.slug) : slugify(generated.meta.name);
  let slug = base || `form-${Date.now()}`;
  let suffix = 1;
  while (await Bun.file(join(formDir(projectPath, slug), "meta.json")).exists()) {
    slug = `${base}-${suffix++}`;
  }

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

export { projectFormsDir, slugify };
