import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  ArgMapping,
  ArgMappingKind,
  CommandSpec,
  FieldType,
  FormDefinition,
  FormEvents,
  FormField,
  FormFolder,
  FormMeta,
  MagicField,
  OutputSpec,
  OutputType,
} from "../../shared/types";
import { listProjects } from "../config";
import { ensureProjectDirs, projectFormsDir } from "../paths";

/** slug -> absolute project path, rebuilt on each listForms(). */
const slugIndex = new Map<string, string>();

/** Resolve which project folder a given form slug lives in. */
export function resolveFormProject(slug: string): string | null {
  return slugIndex.get(slug) ?? null;
}

const FIELD_TYPES: FieldType[] = ["text", "textarea", "select", "multicheck", "number", "file", "date"];
const OUTPUT_TYPES: OutputType[] = ["text", "table", "image", "audio", "video", "json"];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateMeta(raw: unknown, slug: string, projectName: string): FormMeta | null {
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
  };
}

function validateMagic(raw: unknown): MagicField | undefined {
  if (!isObject(raw) || typeof raw.prompt !== "string" || !raw.prompt.trim()) return undefined;
  return {
    prompt: raw.prompt,
    source: raw.source === "event" ? "event" : "prompt",
  };
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

function validateField(raw: unknown): FormField | null {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.label !== "string") return null;
  const type = FIELD_TYPES.includes(raw.type as FieldType) ? (raw.type as FieldType) : "text";
  return {
    id: raw.id,
    label: raw.label,
    type,
    placeholder: typeof raw.placeholder === "string" ? raw.placeholder : undefined,
    required: raw.required === true,
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

function validateOutputs(raw: unknown, outputType: OutputType): OutputSpec[] {
  const outputs: OutputSpec[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!isObject(item)) continue;
      const kind =
        item.kind === "effect" || OUTPUT_TYPES.includes(item.kind as OutputType)
          ? (item.kind as OutputSpec["kind"])
          : "text";
      outputs.push({
        kind,
        description: typeof item.description === "string" ? item.description : undefined,
      });
    }
  }
  return outputs.length > 0 ? outputs : [{ kind: outputType }];
}

function validateEvents(raw: unknown): FormEvents {
  const obj = isObject(raw) ? raw : {};
  const names = (v: unknown) =>
    Array.isArray(v) ? v.filter((n): n is string => typeof n === "string" && n.trim().length > 0) : [];
  return { emits: names(obj.emits), listensFor: names(obj.listensFor) };
}

function validateForm(raw: unknown): FormDefinition | null {
  if (!isObject(raw)) return null;
  if (!Array.isArray(raw.fields)) return null;
  const fields = raw.fields.map(validateField).filter((f): f is FormField => f !== null);
  const outputType = OUTPUT_TYPES.includes(raw.outputType as OutputType) ? (raw.outputType as OutputType) : "text";
  const command = validateCommand(raw.command);
  return {
    fields,
    aiPromptField: raw.aiPromptField === true,
    outputType,
    outputs: validateOutputs(raw.outputs, outputType),
    events: validateEvents(raw.events),
    command,
    // Legacy script forms always had a scriptFile; a command form has none.
    scriptFile: typeof raw.scriptFile === "string" ? raw.scriptFile : command ? undefined : "script.sh",
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

export async function loadFormFolder(
  projectPath: string,
  slug: string,
  projectName: string,
): Promise<FormFolder | null> {
  const dir = join(projectFormsDir(projectPath), slug);
  const metaRaw = await readJson(join(dir, "meta.json"));
  const formRaw = await readJson(join(dir, "form.json"));
  const meta = validateMeta(metaRaw, slug, projectName);
  const form = validateForm(formRaw);
  if (!meta || !form) {
    console.warn(`[forms] Skipping malformed form folder: ${slug}`);
    return null;
  }
  return { meta, form, projectPath };
}

/** Scan every registered project's forms directory and return all valid forms. */
export async function listForms(): Promise<FormFolder[]> {
  const projects = await listProjects();
  slugIndex.clear();
  const folders: FormFolder[] = [];

  for (const project of projects) {
    ensureProjectDirs(project.path);
    const formsDir = projectFormsDir(project.path);
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
      const folder = await loadFormFolder(project.path, entry, project.name);
      if (folder) {
        slugIndex.set(folder.meta.slug, project.path);
        folders.push(folder);
      }
    }
  }

  folders.sort((a, b) => a.meta.name.localeCompare(b.meta.name));
  return folders;
}

/** Distinct project names across all forms, alphabetically sorted. */
export function projectsFromForms(forms: FormFolder[]): string[] {
  const set = new Set(forms.map((f) => f.meta.project).filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
