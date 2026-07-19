/**
 * Task loader: translates on-disk "form" vocabulary to in-memory "task" types.
 *
 * DISK FORMAT FIREWALL (ticket 96):
 * - Disk layout: `<project>/forms/<slug>/form.json` and `meta.json` — stays unchanged.
 * - Memory: TaskFolder, TaskMeta, TaskDefinition, TaskField.
 * - This loader and its sibling writer are the translation boundary.
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  ArgMapping,
  ArgMappingKind,
  CommandSpec,
  Extraction,
  ExtractionSelector,
  FieldType,
  MagicField,
  OutputDefinition,
  OutputTransform,
  OutputType,
  TaskDefinition,
  TaskField,
  TaskFolder,
  TaskMeta,
  TaskVersionInfo,
} from "../../shared/types";
import { listProjects } from "../config";
import { ensureProjectDirs, projectFormsDir } from "../paths";

/** slug -> absolute project path, rebuilt on each listTasks(). */
const slugIndex = new Map<string, string>();

/** Resolve which project folder a given task slug lives in. */
export function resolveTaskProject(slug: string): string | null {
  return slugIndex.get(slug) ?? null;
}

const FIELD_TYPES: FieldType[] = ["text", "textarea", "select", "multicheck", "number", "file", "date"];
const OUTPUT_TYPES: OutputType[] = ["text", "table", "image", "audio", "video", "json"];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateMeta(raw: unknown, slug: string, projectName: string): TaskMeta | null {
  if (!isObject(raw)) return null;
  if (typeof raw.name !== "string") {
    return null;
  }
  return {
    name: raw.name,
    slug: typeof raw.slug === "string" ? raw.slug : slug,
    description: typeof raw.description === "string" ? raw.description : "",
    project: projectName,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === "string") : [],
    interpreter:
      raw.interpreter === "python3" ||
      raw.interpreter === "node" ||
      raw.interpreter === "bun" ||
      raw.interpreter === "bash"
        ? raw.interpreter
        : "bash",
    aiProvider:
      raw.aiProvider === "claude" || raw.aiProvider === "openai" || raw.aiProvider === "ollama"
        ? raw.aiProvider
        : undefined,
    aiModel: typeof raw.aiModel === "string" && raw.aiModel.trim() ? raw.aiModel : undefined,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    // Ticket 105: default existing tasks to draft/1 on load (no disk migration needed).
    lifecycle: raw.lifecycle === "adopted" ? "adopted" : "draft",
    version: typeof raw.version === "number" && raw.version > 0 ? raw.version : 1,
  };
}

/** Prompt-only since ticket 85 — legacy `source`/`payloadMapping` keys on disk are ignored. */
function validateMagic(raw: unknown): MagicField | undefined {
  if (!isObject(raw) || typeof raw.prompt !== "string" || !raw.prompt.trim()) return undefined;
  return { prompt: raw.prompt };
}

const ARG_MAPPING_KINDS: ArgMappingKind[] = ["flag", "option", "positional", "env", "stdin"];

function validateArgMapping(raw: unknown): ArgMapping | undefined {
  if (!isObject(raw)) return undefined;
  if (!ARG_MAPPING_KINDS.includes(raw.kind as ArgMappingKind)) return undefined;
  return {
    kind: raw.kind as ArgMappingKind,
    flag: typeof raw.flag === "string" ? raw.flag : undefined,
    style: raw.style === "equals" ? "equals" : raw.style === "space" ? "space" : undefined,
    order: typeof raw.order === "number" ? raw.order : undefined,
    repeat: raw.repeat === true,
    envName: typeof raw.envName === "string" ? raw.envName : undefined,
  };
}

function validateField(raw: unknown): TaskField | null {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.label !== "string") return null;
  const type = FIELD_TYPES.includes(raw.type as FieldType) ? (raw.type as FieldType) : "text";
  return {
    id: raw.id,
    label: raw.label,
    type,
    description: typeof raw.description === "string" && raw.description.trim() ? raw.description : undefined,
    placeholder: typeof raw.placeholder === "string" ? raw.placeholder : undefined,
    required: raw.required === true,
    secret: raw.secret === true ? true : undefined,
    options: Array.isArray(raw.options) ? raw.options.filter((o): o is string => typeof o === "string") : undefined,
    argTemplate: typeof raw.argTemplate === "string" ? raw.argTemplate : undefined,
    argMapping: validateArgMapping(raw.argMapping),
    magic: validateMagic(raw.magic),
  };
}

function validateCommand(raw: unknown): CommandSpec | undefined {
  if (!isObject(raw)) return undefined;
  if (typeof raw.tool !== "string" || !raw.tool.trim()) return undefined;
  return {
    tool: raw.tool,
    baseArgs: Array.isArray(raw.baseArgs) ? raw.baseArgs.filter((a): a is string => typeof a === "string") : [],
  };
}

const MEDIA_KINDS: OutputType[] = ["image", "audio", "video"];

/** The default extraction for a bare kind: whole stdout, or the last-printed-path for media. */
function defaultExtractionForKind(kind: OutputType): Extraction {
  return MEDIA_KINDS.includes(kind)
    ? { source: "file", selector: { type: "lastPathLine" } }
    : { source: "stdout", selector: { type: "whole" } };
}

function validateSelector(raw: unknown): ExtractionSelector | null {
  if (!isObject(raw)) return null;
  switch (raw.type) {
    case "whole":
      return { type: "whole" };
    case "regex":
      return typeof raw.pattern === "string"
        ? { type: "regex", pattern: raw.pattern, group: typeof raw.group === "number" ? raw.group : undefined }
        : null;
    case "jsonPath":
      return typeof raw.path === "string" ? { type: "jsonPath", path: raw.path } : null;
    case "lines":
      return {
        type: "lines",
        from: typeof raw.from === "number" ? raw.from : undefined,
        to: typeof raw.to === "number" ? raw.to : undefined,
      };
    case "lastPathLine":
      return { type: "lastPathLine" };
    default:
      return null;
  }
}

function validateTransforms(raw: unknown): OutputTransform[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: OutputTransform[] = [];
  for (const t of raw) {
    if (!isObject(t)) continue;
    if (t.type === "pickKeys" && isObject(t.mapping)) {
      const mapping: Record<string, string> = {};
      for (const [k, v] of Object.entries(t.mapping)) if (typeof v === "string") mapping[k] = v;
      out.push({ type: "pickKeys", mapping });
    } else if (t.type === "template" && typeof t.template === "string") {
      out.push({ type: "template", template: t.template });
    } else if (t.type === "parseNumber" || t.type === "trim") {
      out.push({ type: t.type });
    }
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Validates output definitions (ticket 86), migrating the two legacy shapes
 * losslessly: bare-kind lists (`[{kind}]`, possibly with retired "effect"
 * entries — dropped) and the older single `outputType` become one
 * whole-output definition per kind.
 */
function validateOutputs(raw: unknown, outputType: OutputType): OutputDefinition[] {
  const defs: OutputDefinition[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!isObject(item)) continue;
      // New shape: has id/name/extraction.
      if (typeof item.id === "string" && typeof item.name === "string" && isObject(item.extraction)) {
        const ex = item.extraction as Record<string, unknown>;
        const selector = validateSelector(ex.selector);
        const kind = OUTPUT_TYPES.includes(item.kind as OutputType) ? (item.kind as OutputType) : "text";
        if (!selector) continue;
        defs.push({
          id: item.id,
          name: item.name,
          kind,
          extraction: {
            source: ex.source === "stderr" || ex.source === "file" ? ex.source : "stdout",
            selector,
          },
          transforms: validateTransforms(item.transforms),
        });
        continue;
      }
      // Legacy shape: bare kind (retired "effect" entries are dropped).
      if (OUTPUT_TYPES.includes(item.kind as OutputType)) {
        const kind = item.kind as OutputType;
        defs.push({ id: `legacy-${kind}`, name: kind, kind, extraction: defaultExtractionForKind(kind) });
      }
    }
  }
  if (defs.length > 0) return defs;
  return [
    {
      id: `legacy-${outputType}`,
      name: outputType,
      kind: outputType,
      extraction: defaultExtractionForKind(outputType),
    },
  ];
}

function validateForm(raw: unknown): TaskDefinition | null {
  if (!isObject(raw)) return null;
  if (!Array.isArray(raw.fields)) return null;
  const fields = raw.fields.map(validateField).filter((f): f is TaskField => f !== null);
  const outputType = OUTPUT_TYPES.includes(raw.outputType as OutputType) ? (raw.outputType as OutputType) : "text";
  const command = validateCommand(raw.command);
  // Ticket 99: engine discriminator + native tool id.
  const engine = raw.engine === "native" ? "native" : raw.engine === "command" ? "command" : undefined;
  const nativeTool = typeof raw.nativeTool === "string" && raw.nativeTool.trim() ? raw.nativeTool : undefined;

  // Ticket 102: parse fileAssociations if present.
  let fileAssociations: { locationId: string; pattern?: string }[] | undefined;
  if (Array.isArray(raw.fileAssociations)) {
    const validated: { locationId: string; pattern?: string }[] = [];
    for (const assoc of raw.fileAssociations) {
      if (isObject(assoc) && typeof assoc.locationId === "string") {
        validated.push({
          locationId: assoc.locationId,
          pattern: typeof assoc.pattern === "string" ? assoc.pattern : undefined,
        });
      }
    }
    if (validated.length > 0) fileAssociations = validated;
  }

  return {
    fields,
    aiPromptField: raw.aiPromptField === true,
    outputType,
    outputs: validateOutputs(raw.outputs, outputType),
    // `events` keys on disk are ignored since ticket 85 (bus removed).
    command,
    // Legacy script forms always had a scriptFile; a command form has none.
    scriptFile: typeof raw.scriptFile === "string" ? raw.scriptFile : command ? undefined : "script.sh",
    engine,
    nativeTool,
    fileAssociations,
  };
}

async function readJson(path: string): Promise<unknown | null> {
  try {
    const file = Bun.file(path);
    if (!(await file.exists())) return null;
    return JSON.parse(await file.text());
  } catch {
    return null;
  }
}

/**
 * Load native tool configuration (ticket 99). For browser-automation tasks,
 * reads browser.json from the task folder.
 */
async function loadNativeConfig(
  dir: string,
  nativeTool: string | undefined,
): Promise<TaskFolder["native"] | undefined> {
  if (nativeTool !== "browser-automation") return undefined;
  const browserRaw = await readJson(join(dir, "browser.json"));
  if (!browserRaw || !isObject(browserRaw) || !Array.isArray(browserRaw.steps)) return undefined;
  // Type assertion is safe here because we've validated the structure above.
  return { browser: { steps: browserRaw.steps } as import("../../shared/types").BrowserAutomationConfig };
}

export async function loadTaskFolder(
  projectPath: string,
  slug: string,
  projectName: string,
): Promise<TaskFolder | null> {
  const dir = join(projectFormsDir(projectPath), slug);
  const metaRaw = await readJson(join(dir, "meta.json"));
  const formRaw = await readJson(join(dir, "form.json")); // Disk still says "form.json"
  const meta = validateMeta(metaRaw, slug, projectName);
  const task = validateForm(formRaw);
  if (!meta || !task) {
    console.warn(`[tasks] Skipping malformed task folder: ${slug}`);
    return null;
  }
  const native = await loadNativeConfig(dir, task.nativeTool);
  return { meta, task, projectPath, native };
}

/**
 * Load a specific version of a task (ticket 105). Version folders live at
 * `forms/<slug>/versions/<n>/`. Returns null if the version doesn't exist.
 */
export async function loadTaskVersion(
  projectPath: string,
  slug: string,
  version: number,
  projectName: string,
): Promise<TaskFolder | null> {
  const versionDir = join(projectFormsDir(projectPath), slug, "versions", String(version));
  const metaRaw = await readJson(join(versionDir, "meta.json"));
  const formRaw = await readJson(join(versionDir, "form.json"));
  const meta = validateMeta(metaRaw, slug, projectName);
  const task = validateForm(formRaw);
  if (!meta || !task) return null;
  const native = await loadNativeConfig(versionDir, task.nativeTool);
  return { meta, task, projectPath, native };
}

/**
 * List all versions of a task (ticket 105). Scans `versions/<n>/` and returns
 * version number + createdAt + lifecycle for each.
 */
export async function listTaskVersions(projectPath: string, slug: string): Promise<TaskVersionInfo[]> {
  const versionsDir = join(projectFormsDir(projectPath), slug, "versions");
  let entries: string[];
  try {
    entries = readdirSync(versionsDir);
  } catch {
    return [];
  }
  const versions: TaskVersionInfo[] = [];
  for (const entry of entries) {
    const versionNum = Number(entry);
    if (!Number.isInteger(versionNum) || versionNum < 1) continue;
    const metaRaw = await readJson(join(versionsDir, entry, "meta.json"));
    if (!isObject(metaRaw)) continue;
    versions.push({
      version: versionNum,
      createdAt: typeof metaRaw.createdAt === "string" ? metaRaw.createdAt : new Date().toISOString(),
      lifecycle: metaRaw.lifecycle === "adopted" ? "adopted" : "draft",
    });
  }
  versions.sort((a, b) => a.version - b.version);
  return versions;
}

/** Scan every registered project's tasks directory and return all valid tasks. */
export async function listTasks(): Promise<TaskFolder[]> {
  const projects = await listProjects();
  slugIndex.clear();
  const folders: TaskFolder[] = [];

  for (const project of projects) {
    ensureProjectDirs(project.path);
    const formsDir = projectFormsDir(project.path); // Disk directory still named "forms"
    let entries: string[];
    try {
      entries = readdirSync(formsDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      let isDir = false;
      try {
        isDir = statSync(join(formsDir, entry)).isDirectory();
      } catch {
        isDir = false;
      }
      if (!isDir) continue;
      const folder = await loadTaskFolder(project.path, entry, project.name);
      if (folder) {
        slugIndex.set(folder.meta.slug, project.path);
        folders.push(folder);
      }
    }
  }

  folders.sort((a, b) => a.meta.name.localeCompare(b.meta.name));
  return folders;
}

/** Distinct project names across all tasks, alphabetically sorted. */
export function projectsFromTasks(tasks: TaskFolder[]): string[] {
  const set = new Set(tasks.map((f) => f.meta.project).filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
