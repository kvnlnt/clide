import { join } from "node:path";
import type { FormDefinition, FormMeta } from "../../shared/types";
import { addProject, loadProjects } from "../config";
import { ensureDir, ensureProjectDirs, formDir } from "../paths";

interface Seed {
  meta: Omit<FormMeta, "createdAt" | "updatedAt">;
  form: FormDefinition;
  script: string;
}

const SEEDS: Seed[] = [
  {
    meta: {
      name: "Create Media Post",
      slug: "create-media-post",
      description: "Publishes a post to selected social platforms",
      project: "Abounding Grace",
      tags: ["social", "publish"],
      interpreter: "bash",
    },
    form: {
      fields: [
        {
          id: "post",
          label: "Post",
          type: "textarea",
          placeholder: "Enter your post here...",
          required: true,
          argTemplate: "--post {{value}}",
        },
        {
          id: "platforms",
          label: "Platforms",
          type: "multicheck",
          options: ["Youtube", "Facebook", "X", "Instagram"],
          argTemplate: "--platforms {{values}}",
        },
      ],
      aiPromptField: true,
      outputType: "text",
      scriptFile: "script.sh",
    },
    script: `#!/bin/bash
# Demo: echoes back the post and chosen platforms.
post=""
platforms=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --post) post="$2"; shift 2 ;;
    --platforms) shift; while [[ $# -gt 0 && "$1" != --* ]]; do platforms="$platforms $1"; shift; done ;;
    *) shift ;;
  esac
done
echo "Publishing post:"
echo "  $post"
echo "To platforms:$platforms"
echo "Done."
`,
  },
  {
    meta: {
      name: "List Files",
      slug: "list-files",
      description: "Lists files in a directory as a table",
      project: "Utilities",
      tags: ["files"],
      interpreter: "bash",
    },
    form: {
      fields: [
        {
          id: "dir",
          label: "Directory",
          type: "text",
          placeholder: "~",
          required: true,
          argTemplate: "--dir {{value}}",
        },
      ],
      outputType: "table",
      scriptFile: "script.sh",
    },
    script: `#!/bin/bash
dir="$HOME"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) dir="$2"; shift 2 ;;
    *) shift ;;
  esac
done
dir="\${dir/#\\~/$HOME}"
echo "name,size,modified"
for f in "$dir"/*; do
  [ -e "$f" ] || continue
  name=$(basename "$f")
  size=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null)
  mod=$(stat -f%Sm "$f" 2>/dev/null || stat -c%y "$f" 2>/dev/null)
  echo "$name,$size,$mod"
done
`,
  },
  {
    meta: {
      name: "System Info",
      slug: "system-info",
      description: "Prints structured system information as JSON",
      project: "Utilities",
      tags: ["system"],
      interpreter: "bash",
    },
    form: {
      fields: [],
      outputType: "json",
      scriptFile: "script.sh",
    },
    script: `#!/bin/bash
cat <<EOF
{
  "hostname": "$(hostname)",
  "user": "$USER",
  "os": "$(uname -s)",
  "arch": "$(uname -m)",
  "shell": "$SHELL",
  "date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
`,
  },
];

/**
 * On very first launch (no projects registered yet), create the example
 * projects and seed each with its demo forms. Each project becomes a real
 * folder on disk under the app's default projects directory.
 */
export async function seedExampleProjects(): Promise<void> {
  const existing = await loadProjects();
  if (existing.length > 0) return;

  const now = new Date().toISOString();
  const byProject = new Map<string, Seed[]>();
  for (const seed of SEEDS) {
    const list = byProject.get(seed.meta.project) ?? [];
    list.push(seed);
    byProject.set(seed.meta.project, list);
  }

  for (const [projectName, seeds] of byProject) {
    const project = await addProject(projectName);
    ensureProjectDirs(project.path);
    for (const seed of seeds) {
      const dir = formDir(project.path, seed.meta.slug);
      ensureDir(dir);
      const meta: FormMeta = { ...seed.meta, project: project.name, createdAt: now, updatedAt: now };
      const scriptFile = seed.form.scriptFile ?? "script.sh";
      await Bun.write(join(dir, "meta.json"), JSON.stringify(meta, null, 2));
      await Bun.write(join(dir, "form.json"), JSON.stringify(seed.form, null, 2));
      await Bun.write(join(dir, scriptFile), seed.script);
      try {
        await Bun.spawn(["chmod", "+x", join(dir, scriptFile)]).exited;
      } catch {
        /* non-fatal */
      }
    }
  }
  console.log(`[forms] Seeded ${byProject.size} example projects.`);
}
