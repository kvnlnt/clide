#!/usr/bin/env bun
/**
 * Seeds a dev "profile" — a persona-shaped snapshot of app-data (projects,
 * forms, run history, AI services, views, schedules) — so `bun run
 * dev:hmr:<profile>` boots CLIDE into a realistic, repeatable scenario
 * instead of whatever has accumulated in the real dev app-data dir (ticket
 * 79). Reuses the same bun-side modules the running app uses (config.ts,
 * db/history.ts, forms/views.ts, ai/aiServices.ts) so fixtures can never
 * drift from the real on-disk/DB schema.
 *
 * Usage: CLIDE_PROFILE=<name> bun run scripts/seed-profile.ts
 * (the package.json `dev:hmr:<name>` scripts do this for you)
 *
 * Reset-on-launch by default — wipes the profile's app-data dir and
 * reseeds from scratch every run. Set CLIDE_PROFILE_KEEP=1 to skip
 * reseeding and keep whatever state the last run left behind.
 */
import { rmSync } from "node:fs";
import { join } from "node:path";
import { addProject } from "../src/bun/config";
import { saveAIServices } from "../src/bun/ai/aiServices";
import { createRun, setPinned, updateRunStatus } from "../src/bun/db/history";
import { writeViews } from "../src/bun/forms/views";
import { slugify } from "../src/bun/forms/writer";
import { appDataDir, ensureDir, formDir } from "../src/bun/paths";
import { writeUIState } from "../src/bun/uiState";
import type { FormDefinition, FormField, FormMeta, RepeatInterval, RunStatus, ThreadView } from "../src/shared/types";

const profile = process.env.CLIDE_PROFILE?.trim();
if (!profile) {
  console.error("CLIDE_PROFILE is not set — nothing to seed. Use one of the `bun run dev:hmr:<profile>` scripts.");
  process.exit(1);
}

const KEEP = process.env.CLIDE_PROFILE_KEEP === "1";

// ---------------------------------------------------------------------------
// Time helpers — seeded relative to "now" so the thread's date grouping and
// the calendar always look alive regardless of when a profile is run.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

function pastISO(daysAgo: number, hour = 9, minute = 0): string {
  const d = new Date(Date.now() - daysAgo * DAY_MS);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function futureISO(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!;
}

// ---------------------------------------------------------------------------
// Form templates — a small reusable pool, instantiated per project. Mirrors
// the shape of forms/seed.ts's demo forms (kept there for its own purpose);
// duplicated here on purpose so profile fixtures don't depend on that file's
// internals changing out from under this script.
// ---------------------------------------------------------------------------

interface FormTemplate {
  name: string;
  description: string;
  tags: string[];
  fields: FormField[];
  outputType: FormDefinition["outputType"];
  aiPromptField?: boolean;
  script: string;
  /** Skip writing the script file / chmod — used by the "edge" profile to seed a broken form. */
  brokenScript?: boolean;
}

const TEMPLATES: FormTemplate[] = [
  {
    name: "List Files",
    description: "Lists files in a directory as a table",
    tags: ["files"],
    fields: [
      { id: "dir", label: "Directory", type: "text", placeholder: "~", required: true, argTemplate: "--dir {{value}}" },
    ],
    outputType: "table",
    script: `#!/bin/bash
dir="\${1:-$HOME}"
echo "name,size,modified"
for f in "$dir"/*; do
  [ -e "$f" ] || continue
  echo "$(basename "$f"),$(stat -f%z "$f" 2>/dev/null || echo 0),$(date)"
done
`,
  },
  {
    name: "System Info",
    description: "Prints structured system information as JSON",
    tags: ["system"],
    fields: [],
    outputType: "json",
    script: `#!/bin/bash
cat <<EOF
{ "hostname": "$(hostname)", "os": "$(uname -s)", "date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)" }
EOF
`,
  },
  {
    name: "Create Media Post",
    description: "Publishes a post to selected social platforms",
    tags: ["social", "publish"],
    fields: [
      { id: "post", label: "Post", type: "textarea", placeholder: "Enter your post here...", required: true },
      { id: "platforms", label: "Platforms", type: "multicheck", options: ["Youtube", "Facebook", "X", "Instagram"] },
    ],
    aiPromptField: true,
    outputType: "text",
    script: `#!/bin/bash
echo "Publishing post..."
echo "Done."
`,
  },
  {
    name: "Backup Folder",
    description: "Archives a folder to a timestamped zip",
    tags: ["backup"],
    fields: [
      { id: "source", label: "Source folder", type: "text", required: true },
    ],
    outputType: "text",
    script: `#!/bin/bash
echo "Backing up \${1:-.}..."
echo "Done."
`,
  },
  {
    name: "Send Notification",
    description: "Sends a Slack/email notification",
    tags: ["notify"],
    fields: [
      { id: "message", label: "Message", type: "textarea", required: true },
    ],
    outputType: "text",
    script: `#!/bin/bash
echo "Notification sent: \${1:-(no message)}"
`,
  },
];

async function writeTemplateForm(projectPath: string, projectName: string, template: FormTemplate, now: string): Promise<string> {
  const slug = slugify(template.name);
  const dir = formDir(projectPath, slug);
  ensureDir(dir);
  const meta: FormMeta = {
    name: template.name,
    slug,
    description: template.description,
    project: projectName,
    tags: template.tags,
    interpreter: "bash",
    createdAt: now,
    updatedAt: now,
  };
  const form: FormDefinition = {
    fields: template.fields,
    aiPromptField: template.aiPromptField,
    outputType: template.outputType,
    scriptFile: template.brokenScript ? undefined : "script.sh",
  };
  await Bun.write(join(dir, "meta.json"), JSON.stringify(meta, null, 2));
  await Bun.write(join(dir, "form.json"), JSON.stringify(form, null, 2));
  if (!template.brokenScript) {
    await Bun.write(join(dir, "script.sh"), template.script);
    try {
      await Bun.spawn(["chmod", "+x", join(dir, "script.sh")]).exited;
    } catch {
      /* non-fatal */
    }
  }
  return slug;
}

/**
 * Seeds one persisted run and returns its id. `status` is the final state:
 * "success"/"error" get a finishedAt+exitCode via a follow-up update (the
 * only way to set those columns); "pending"/"running"/"scheduled" are
 * inserted as-is and correctly have neither, since they aren't finished.
 */
function seedRun(
  projectPath: string,
  formSlug: string,
  opts: {
    daysAgo?: number;
    hour?: number;
    status: RunStatus;
    exitCode?: number;
    pinned?: boolean;
    scheduledInHours?: number;
    repeatInterval?: RepeatInterval;
    inputs?: Record<string, unknown>;
  },
): string {
  const id = crypto.randomUUID();
  const startedAt = opts.daysAgo !== undefined ? pastISO(opts.daysAgo, opts.hour ?? 9) : new Date().toISOString();
  const scheduledAt = opts.status === "scheduled" ? futureISO(opts.scheduledInHours ?? 24) : null;
  createRun(projectPath, {
    id,
    formSlug,
    inputs: opts.inputs ?? {},
    status: opts.status,
    startedAt,
    scheduledAt,
    repeatInterval: opts.repeatInterval ?? "none",
  });
  if (opts.status === "success" || opts.status === "error") {
    const finishedAt = pastISO(Math.max(0, opts.daysAgo ?? 0), (opts.hour ?? 9) + 1);
    updateRunStatus(id, opts.status, opts.exitCode ?? (opts.status === "success" ? 0 : 1), finishedAt);
  }
  if (opts.pinned) setPinned(id, true);
  return id;
}

function makeView(name: string, opts: { hidden?: boolean } = {}): ThreadView {
  return { id: crypto.randomUUID(), name, filters: {}, hidden: opts.hidden };
}

// ---------------------------------------------------------------------------
// Profile: reset the app-data dir (unless kept), then hand off to the
// profile-specific seeder.
// ---------------------------------------------------------------------------

async function resetProfileDir(): Promise<void> {
  const dir = appDataDir();
  if (!KEEP) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  ensureDir(dir);
}

async function seedNewbie(): Promise<void> {
  // Nothing at all — zero projects, zero AI services, zero history. This is
  // the exact state tickets 76/78 (first-run takeovers) exist to handle.
}

async function seedBeginner(): Promise<void> {
  const now = new Date().toISOString();
  const projectNames = ["My First Project", "Website Scripts"];
  for (let p = 0; p < projectNames.length; p++) {
    const project = await addProject(projectNames[p]!);
    const forms = [TEMPLATES[0]!, TEMPLATES[1]!, TEMPLATES[2]!];
    const slugs = await Promise.all(forms.map((t) => writeTemplateForm(project.path, project.name, t, now)));
    for (let i = 0; i < 6; i++) {
      seedRun(project.path, pick(slugs, i), {
        daysAgo: i,
        status: i === 5 ? "error" : "success",
        exitCode: i === 5 ? 1 : 0,
      });
    }
  }
  await saveAIServices([
    { id: crypto.randomUUID(), name: "Local Ollama", kind: "ollama", baseUrl: "http://localhost:11434", isDefault: true },
  ]);
  await writeUIState({ activeProject: null, activeViewByProject: {}, recentProjects: [projectNames[0]!] });
}

async function seedRegular(): Promise<void> {
  const now = new Date().toISOString();
  const projectNames = ["Marketing Site", "Podcast Pipeline", "Data Backups", "Internal Tools"];
  const recents: string[] = [];
  for (let p = 0; p < projectNames.length; p++) {
    const project = await addProject(projectNames[p]!);
    recents.push(project.name);
    const slugs = await Promise.all(TEMPLATES.map((t) => writeTemplateForm(project.path, project.name, t, now)));

    // ~60 runs per project, spread over the last ~45 days, mostly success with some failures.
    for (let i = 0; i < 60; i++) {
      const daysAgo = Math.floor((i / 60) * 45);
      const failed = i % 9 === 0;
      seedRun(project.path, pick(slugs, i), {
        daysAgo,
        hour: 8 + (i % 10),
        status: failed ? "error" : "success",
        exitCode: failed ? 1 : 0,
        pinned: i % 20 === 0,
      });
    }
    // A couple of upcoming schedules, one recurring.
    seedRun(project.path, pick(slugs, 0), { status: "scheduled", scheduledInHours: 6 + p * 4 });
    seedRun(project.path, pick(slugs, 1), { status: "scheduled", scheduledInHours: 30, repeatInterval: "daily" });

    await writeViews(project.path, [
      makeView("Failures"),
      makeView("Pinned"),
      makeView("This week"),
    ]);
  }
  await saveAIServices([
    { id: crypto.randomUUID(), name: "Local Ollama", kind: "ollama", baseUrl: "http://localhost:11434", isDefault: true },
    { id: crypto.randomUUID(), name: "Work Claude", kind: "anthropic" },
  ]);
  await writeUIState({ activeProject: null, activeViewByProject: {}, recentProjects: recents });
}

async function seedPower(): Promise<void> {
  const now = new Date().toISOString();
  const projectNames = Array.from({ length: 16 }, (_, i) => `Project ${i + 1}`);
  const recents: string[] = [];
  for (let p = 0; p < projectNames.length; p++) {
    const project = await addProject(projectNames[p]!);
    recents.push(project.name);
    const big = p < 3; // a few projects get the heavy 25+ form treatment
    const formCount = big ? 26 : TEMPLATES.length;
    const slugs: string[] = [];
    for (let f = 0; f < formCount; f++) {
      const template = pick(TEMPLATES, f);
      const slug = await writeTemplateForm(
        project.path,
        project.name,
        f < TEMPLATES.length ? template : { ...template, name: `${template.name} ${f}` },
        now,
      );
      slugs.push(slug);
    }

    const runCount = big ? 180 : 90;
    for (let i = 0; i < runCount; i++) {
      const daysAgo = Math.floor((i / runCount) * 120);
      const roll = i % 15;
      const status: RunStatus = roll === 0 ? "error" : roll === 1 ? "pending" : "success";
      seedRun(project.path, pick(slugs, i), {
        daysAgo,
        hour: 6 + (i % 14),
        status,
        exitCode: status === "error" ? 1 : 0,
        pinned: i % 40 === 0,
      });
    }

    // Dozens of schedules per project, several recurring, several stacked on the same day.
    for (let s = 0; s < 8; s++) {
      seedRun(project.path, pick(slugs, s), {
        status: "scheduled",
        scheduledInHours: 12 + s * 3, // several land within the same day/window
        repeatInterval: s % 3 === 0 ? "daily" : s % 3 === 1 ? "weekly" : "none",
      });
    }

    const views: ThreadView[] = [makeView("Errors"), makeView("Pinned"), makeView("Archive", { hidden: true })];
    if (big) views.push(makeView("Old experiment", { hidden: true }), makeView("Needs review"));
    await writeViews(project.path, views);
  }
  await saveAIServices([
    { id: crypto.randomUUID(), name: "Local Ollama", kind: "ollama", baseUrl: "http://localhost:11434", isDefault: true },
    { id: crypto.randomUUID(), name: "Work Claude", kind: "anthropic" },
  ]);
  await writeUIState({ activeProject: null, activeViewByProject: {}, recentProjects: recents.slice(0, 10) });
}

async function seedEdge(): Promise<void> {
  const now = new Date().toISOString();
  const pathologicalNames = [
    "🔥 Launch Campaign 🚀",
    "日本語プロジェクト",
    "Very ".repeat(12) + "Long Project Name That Keeps Going",
    "emp/ty-ish",
    "Normal Project",
  ];
  const recents: string[] = [];
  for (let p = 0; p < pathologicalNames.length; p++) {
    const project = await addProject(pathologicalNames[p]!);
    recents.push(project.name);
    const slugs = await Promise.all(
      TEMPLATES.map((t, i) =>
        writeTemplateForm(
          project.path,
          project.name,
          i === 1 ? { ...t, brokenScript: true, name: `${t.name} (broken)` } : t,
          now,
        ),
      ),
    );

    for (let i = 0; i < 10; i++) {
      seedRun(project.path, pick(slugs, i), { daysAgo: i, status: i % 4 === 0 ? "error" : "success" });
    }

    // Orphaned schedule: references a form slug that doesn't exist in this project.
    seedRun(project.path, "deleted-form-slug", { status: "scheduled", scheduledInHours: 4 });

    // 45 chips stacked on the exact same future day, to exercise "+N more" overflow.
    for (let i = 0; i < 45; i++) {
      seedRun(project.path, pick(slugs, i), { status: "scheduled", scheduledInHours: 48 + i * 0.1 });
    }
  }
  await saveAIServices([{ id: crypto.randomUUID(), name: "Local Ollama", kind: "ollama", baseUrl: "http://localhost:11434", isDefault: true }]);
  await writeUIState({ activeProject: null, activeViewByProject: {}, recentProjects: recents });
}

const PROFILES: Record<string, () => Promise<void>> = {
  newbie: seedNewbie,
  beginner: seedBeginner,
  regular: seedRegular,
  power: seedPower,
  edge: seedEdge,
};

async function main(): Promise<void> {
  const seeder = PROFILES[profile!];
  if (!seeder) {
    console.error(`Unknown profile "${profile}". Known profiles: ${Object.keys(PROFILES).join(", ")}`);
    process.exit(1);
  }
  if (KEEP) {
    console.log(`[seed-profile] CLIDE_PROFILE_KEEP=1 — keeping existing state for "${profile}", not reseeding.`);
    ensureDir(appDataDir());
    return;
  }
  console.log(`[seed-profile] Seeding profile "${profile}" at ${appDataDir()}...`);
  await resetProfileDir();
  await seeder();
  console.log(`[seed-profile] Done.`);
}

await main();
