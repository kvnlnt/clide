/**
 * Transparency (ticket 125): everything the app has collected about the
 * user, in one place, with a Reveal button and a plain-text manifest that's
 * regenerated from this file's registry on every reveal — never hand-typed
 * prose that can drift from what's actually collected.
 *
 * HONESTY RULE: when a new feature starts persisting anything about the
 * user, their machine, or their activity, add an entry to
 * `collectionEntries()` below. This is the single source of truth the
 * manifest is generated from.
 */

import { join } from "node:path";
import { loadProjects } from "./config";
import { aiServicesPath, appDataDir, ensureDir, projectsRegistryPath, toolsDir } from "./paths";
import { userProfilePath } from "./profile";

interface CollectionEntry {
  label: string;
  description: string;
  scope: "app" | "project" | "system";
  /** Absolute path for app/project scope; a plain description for system scope (nothing to point Finder at). */
  location: string;
}

async function collectionEntries(): Promise<CollectionEntry[]> {
  const entries: CollectionEntry[] = [
    {
      label: "App profile",
      description: "AI-interviewed profile of you — roles, goals, frustrations (tickets 100/111).",
      scope: "app",
      location: userProfilePath(),
    },
    {
      label: "Registered projects",
      description: "Names and folder paths of every project you've added.",
      scope: "app",
      location: projectsRegistryPath(),
    },
    {
      label: "AI services",
      description: "Configured AI providers: name, kind, base URL, default model. API keys are NOT here — see below.",
      scope: "app",
      location: aiServicesPath(),
    },
    {
      label: "UI state",
      description: "Last active project/view, recent projects, appearance preferences (e.g. Compact mode).",
      scope: "app",
      location: join(appDataDir(), "uiState.json"),
    },
    {
      label: "Registered tools",
      description: "CLI tools you've installed or registered, and their inspected --help/man output (ticket 53).",
      scope: "app",
      location: toolsDir(),
    },
    {
      label: "AI service credentials",
      description: 'API keys for AI services — stored as generic passwords under service "dev.clide.ai", never written to a file this app controls.',
      scope: "system",
      location: "macOS system keychain",
    },
  ];

  for (const p of await loadProjects()) {
    entries.push({
      label: `Project: ${p.name}`,
      description:
        "Run history (history.db — task/workflow inputs, outputs, timestamps), task and workflow definitions, this project's own AI-interviewed profile, saved views, scheduled runs. Self-contained in the project's own folder by design (ticket 17) — it isn't duplicated here.",
      scope: "project",
      location: p.path,
    });
  }

  return entries;
}

function formatEntry(e: CollectionEntry): string {
  return [`${e.label}`, `  ${e.description}`, `  Where: ${e.location}`].join("\n");
}

/** (Re)write the manifest so it always reflects what's actually on disk. */
export async function writeTransparencyManifest(): Promise<string> {
  const entries = await collectionEntries();
  const lines = [
    "CLIDE — what this app has collected about you",
    `Generated: ${new Date().toISOString()}`,
    "",
    "This file is regenerated every time you open this folder from Settings",
    "→ Transparency → Reveal — it always reflects what's actually on disk,",
    "not a hand-written promise that could go stale.",
    "",
    "App-scoped data lives in this folder, alongside this file.",
    "Project data lives inside each project's own folder (listed below) so",
    "projects stay self-contained and portable, per the app's design.",
    "",
    ...entries.map((e) => formatEntry(e) + "\n"),
  ];
  const path = join(appDataDir(), "TRANSPARENCY.txt");
  ensureDir(appDataDir());
  await Bun.write(path, lines.join("\n"));
  return path;
}

/** Regenerates the manifest and returns the folder to reveal — the caller opens it via the existing openFolder RPC. */
export async function prepareTransparencyReveal(): Promise<string> {
  await writeTransparencyManifest();
  return appDataDir();
}
