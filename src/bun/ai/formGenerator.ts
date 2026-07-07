import type {
  CreateFormInput,
  DraftFormSpecInput,
  FieldType,
  FormEvents,
  FormField,
  FormSpecDraft,
  GeneratedForm,
  Interpreter,
  MagicField,
  OutputSpec,
  OutputType,
} from "../../shared/types";
import { getAIService, legacyProviderForKind } from "./aiServices";
import { complete } from "./providers";

async function which(cmd: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["which", cmd], {
      stdout: "pipe",
      stderr: "ignore",
    });
    const code = await proc.exited;
    if (code !== 0) return null;
    return (await new Response(proc.stdout).text()).trim() || null;
  } catch {
    return null;
  }
}

async function detectEnvironment(): Promise<string> {
  const interpreters = ["bash", "python3", "node", "bun", "ffmpeg", "curl", "jq"];
  const found: string[] = [];
  for (const cmd of interpreters) {
    const path = await which(cmd);
    if (path) found.push(`${cmd} (${path})`);
  }
  return [
    `OS: ${process.platform} ${process.arch}`,
    `Shell: ${process.env.SHELL ?? "unknown"}`,
    `Available tools: ${found.join(", ") || "none detected"}`,
  ].join("\n");
}

const SCHEMA_SPEC = `
A CLIDE form folder is described by two JSON objects plus a script.

meta: {
  "name": string,
  "slug": string (kebab-case),
  "description": string,
  "project": string,
  "tags": string[],
  "interpreter": "bash" | "python3" | "node" | "bun"
}

form: {
  "fields": Array<{
    "id": string,
    "label": string,
    "type": "text" | "textarea" | "select" | "multicheck" | "number" | "file" | "date",
    "placeholder"?: string,
    "required"?: boolean,
    "options"?: string[]      // for select / multicheck
    "argTemplate"?: string    // e.g. "--name {{value}}" or "--items {{values}}"
  }>,
  "aiPromptField"?: boolean,
  "outputType": "text" | "table" | "image" | "audio" | "video" | "json",
  "scriptFile": string
}

The script reads its arguments (constructed from each field's argTemplate) and
performs the task. {{value}} is replaced by a single value; {{values}} expands a
multi-value field into space-separated argv entries.

For outputType "table", print CSV or a JSON array of objects to stdout.
For outputType "json", print a JSON object to stdout.
For outputType "image"/"audio"/"video", print the absolute file path to stdout.
`;

function extractJson(text: string): unknown {
  // Strip markdown code fences if present.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("AI response did not contain JSON");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

// ---------------------------------------------------------------------------
// Spec drafting (wizard step 1 → 2)
// ---------------------------------------------------------------------------

const FIELD_TYPES: FieldType[] = ["text", "textarea", "select", "multicheck", "number", "file", "date"];
const OUTPUT_TYPES: OutputType[] = ["text", "table", "image", "audio", "video", "json"];
const INTERPRETERS: Interpreter[] = ["bash", "python3", "node", "bun"];

const SPEC_SHAPE = `
{
  "inputs": Array<{
    "id": string (kebab-case),
    "label": string,
    "type": "text" | "textarea" | "select" | "multicheck" | "number" | "file" | "date",
    "placeholder"?: string,
    "required"?: boolean,
    "options"?: string[],       // for select / multicheck
    "magic"?: {                 // ONLY when a field can plausibly fill itself
      "prompt": string,         // associative prompt, e.g. "today's date in ISO format"
      "source": "prompt" | "event"  // "event" only if fill data would come from a triggering event's payload
    }
  }>,
  "procedure": string,          // numbered, step-by-step plan for the script
  "outputs": Array<{
    "kind": "text" | "table" | "image" | "audio" | "video" | "json" | "effect",
    "description"?: string      // required for kind "effect", e.g. "updates the artifact index"
  }>,
  "events": {
    "emits": string[],          // event names fired on success, format "domain:verb" e.g. "media:created"
    "listensFor": string[]      // event names that should auto-submit this form (often empty)
  },
  "interpreter": "bash" | "python3" | "node" | "bun"
}`;

function slugifyId(label: string): string {
  return (
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "field"
  );
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeEventNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const name = item.trim().toLowerCase();
    if (name) seen.add(name);
  }
  return [...seen];
}

function normalizeMagic(raw: unknown): MagicField | undefined {
  if (!isObject(raw) || typeof raw.prompt !== "string" || !raw.prompt.trim()) return undefined;
  return {
    prompt: raw.prompt.trim(),
    source: raw.source === "event" ? "event" : "prompt",
  };
}

function normalizeSpecInputs(raw: unknown): FormField[] {
  if (!Array.isArray(raw)) return [];
  const fields: FormField[] = [];
  const usedIds = new Set<string>();
  for (const item of raw) {
    if (!isObject(item)) continue;
    const label = typeof item.label === "string" && item.label.trim() ? item.label.trim() : "Field";
    const base = typeof item.id === "string" && item.id.trim() ? slugifyId(item.id) : slugifyId(label);
    let id = base;
    let suffix = 2;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    fields.push({
      id,
      label,
      type: FIELD_TYPES.includes(item.type as FieldType) ? (item.type as FieldType) : "text",
      placeholder: typeof item.placeholder === "string" ? item.placeholder : undefined,
      required: item.required === true,
      options: Array.isArray(item.options) ? item.options.filter((o): o is string => typeof o === "string") : undefined,
      magic: normalizeMagic(item.magic),
    });
  }
  return fields;
}

function normalizeOutputs(raw: unknown): OutputSpec[] {
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
        description:
          typeof item.description === "string" && item.description.trim() ? item.description.trim() : undefined,
      });
    }
  }
  return outputs.length > 0 ? outputs : [{ kind: "text" }];
}

function normalizeEvents(raw: unknown): FormEvents {
  const obj = isObject(raw) ? raw : {};
  return {
    emits: normalizeEventNames(obj.emits),
    listensFor: normalizeEventNames(obj.listensFor),
  };
}

/** Validate and normalize an AI-drafted spec into a well-formed FormSpecDraft. */
export function normalizeSpec(raw: unknown): FormSpecDraft {
  const obj = isObject(raw) ? raw : {};
  return {
    inputs: normalizeSpecInputs(obj.inputs),
    procedure: typeof obj.procedure === "string" ? obj.procedure.trim() : "",
    outputs: normalizeOutputs(obj.outputs),
    events: normalizeEvents(obj.events),
    interpreter: INTERPRETERS.includes(obj.interpreter as Interpreter) ? (obj.interpreter as Interpreter) : "bash",
  };
}

/**
 * Ask the configured AI provider to draft a structured, editable form spec
 * from the user's three plain-text descriptions (input/processing/output).
 */
export async function draftFormSpec(input: DraftFormSpecInput): Promise<FormSpecDraft> {
  const service = await getAIService(input.serviceId);
  if (!service) throw new Error("Selected AI service not found");
  const env = await detectEnvironment();

  const system = [
    "You are CLIDE's form planner. You turn plain-language descriptions of a",
    "shell automation into a structured form spec that a user will fine-tune",
    "before any code is generated.",
    "Respond ONLY with a single JSON object, no prose, matching this shape:",
    SPEC_SHAPE,
    'Mark a field "magic" only when it can plausibly fill itself (dates, derived',
    "names, values arriving from a triggering event). Keep the procedure a",
    "short numbered list. Declare emitted events only when the output description",
    "suggests other automations might care; use the domain:verb naming style.",
  ].join("\n");

  const user = [
    `Form name: ${input.name}`,
    `Project: ${input.project}`,
    `Input — what information does this form collect?\n${input.input}`,
    `Processing — what should the script do with it?\n${input.processing}`,
    input.output.trim()
      ? `Output — what does it produce or affect?\n${input.output}`
      : "Output: (infer from the above)",
    "",
    "Local machine environment:",
    env,
  ].join("\n\n");

  const raw = await complete(service, { system, user });
  return normalizeSpec(extractJson(raw));
}

// ---------------------------------------------------------------------------
// Spec-driven generation (wizard step 2 → written form)
// ---------------------------------------------------------------------------

/**
 * Generate a complete form folder from a user-approved spec. The field list is
 * passed verbatim — the AI only supplies argTemplates, the script, metadata,
 * and dependency info. outputs/events/magic are copied through untouched.
 */
export async function generateFormFromSpec(input: CreateFormInput, spec: FormSpecDraft): Promise<GeneratedForm> {
  const service = await getAIService(input.serviceId);
  if (!service) throw new Error("Selected AI service not found");
  const env = await detectEnvironment();
  const now = new Date().toISOString();

  const fieldList = spec.inputs.map(({ id, label, type, options, required }) => ({
    id,
    label,
    type,
    options,
    required,
  }));

  const system = [
    "You are CLIDE's form generator. You write the script for a form whose",
    "fields and behavior were already approved by the user. Do NOT invent,",
    "rename, or drop fields — you only fill in argTemplates for the given ids.",
    "Respond ONLY with a single JSON object, no prose, matching this shape:",
    `{
  "slug": string (kebab-case),
  "description": string (one sentence),
  "tags": string[],
  "argTemplates": { "<fieldId>": "--flag {{value}}" },  // one entry per field id
  "script": "#!/bin/bash\\n... full script ...",
  "scriptExtension": "sh" | "py" | "js" | "ts",
  "dependencyCheck": "shell command that prints 'MISSING: <tool>' if a required CLI is absent",
  "installInstructions": "how to install any missing dependency"
}`,
    "Write a robust, commented script that parses the named flags from the",
    "argTemplates. {{value}} is replaced by a single value; {{values}} expands a",
    "multi-value field into space-separated argv entries.",
    'For output kind "table", print CSV or a JSON array of objects to stdout.',
    'For output kind "json", print a JSON object to stdout.',
    'For output kinds "image"/"audio"/"video", print the absolute file path to stdout.',
    'For "effect" outputs, perform the described side effect within the script.',
  ].join("\n\n");

  const user = [
    `Form name: ${input.name}`,
    `Project: ${input.project}`,
    `Interpreter: ${spec.interpreter}`,
    `Fields (verbatim, fill argTemplates for these ids only):\n${JSON.stringify(fieldList, null, 2)}`,
    `Procedure — the script must do exactly this:\n${spec.procedure}`,
    `Outputs: ${JSON.stringify(spec.outputs)}`,
    "",
    "Local machine environment:",
    env,
  ].join("\n\n");

  const raw = await complete(service, { system, user });
  const parsed = extractJson(raw) as Record<string, unknown>;

  if (typeof parsed.script !== "string") {
    throw new Error("AI response missing required fields");
  }

  const argTemplates = isObject(parsed.argTemplates) ? parsed.argTemplates : {};
  const fields = spec.inputs.map((field) => ({
    ...field,
    magic: field.magic?.prompt ? field.magic : undefined,
    argTemplate: typeof argTemplates[field.id] === "string" ? (argTemplates[field.id] as string) : field.argTemplate,
  }));

  const firstKind = spec.outputs.find((o) => o.kind !== "effect")?.kind as OutputType | undefined;
  const scriptExtension = typeof parsed.scriptExtension === "string" ? parsed.scriptExtension : "sh";

  return {
    meta: {
      name: input.name,
      slug: String(parsed.slug ?? input.name),
      description: String(parsed.description ?? input.description),
      project: input.project,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t): t is string => typeof t === "string") : [],
      interpreter: spec.interpreter,
      aiProvider: legacyProviderForKind(service.kind),
      aiModel: service.model,
      createdAt: now,
      updatedAt: now,
    },
    form: {
      fields,
      aiPromptField: false,
      outputType: firstKind ?? "text",
      outputs: spec.outputs,
      events: spec.events,
      scriptFile: `script.${scriptExtension}`,
    },
    script: parsed.script,
    scriptExtension,
    dependencyCheck: typeof parsed.dependencyCheck === "string" ? parsed.dependencyCheck : undefined,
    installInstructions: typeof parsed.installInstructions === "string" ? parsed.installInstructions : undefined,
  };
}

/**
 * Ask the configured AI provider to generate a complete form folder (meta, form
 * definition, and script) from the user's name + description.
 */
export async function generateForm(input: CreateFormInput): Promise<GeneratedForm> {
  const service = await getAIService(input.serviceId);
  if (!service) throw new Error("Selected AI service not found");
  const env = await detectEnvironment();
  const now = new Date().toISOString();

  const system = [
    "You are CLIDE's form generator. You design shell automation forms.",
    "Respond ONLY with a single JSON object, no prose, matching this shape:",
    `{
  "meta": { ...as specified },
  "form": { ...as specified },
  "script": "#!/bin/bash\\n... full script ...",
  "scriptExtension": "sh",
  "dependencyCheck": "shell command that prints 'MISSING: <tool>' if a required CLI is absent",
  "installInstructions": "how to install any missing dependency"
}`,
    "Write a robust, commented script. Parse named flags from argTemplate.",
    SCHEMA_SPEC,
  ].join("\n\n");

  const user = [
    `Form name: ${input.name}`,
    `Project: ${input.project}`,
    `Description of what it should do: ${input.description}`,
    "",
    "Local machine environment:",
    env,
  ].join("\n");

  const raw = await complete(service, { system, user });
  const parsed = extractJson(raw) as Partial<GeneratedForm> & {
    meta?: Record<string, unknown>;
    form?: Record<string, unknown>;
  };

  if (!parsed.meta || !parsed.form || typeof parsed.script !== "string") {
    throw new Error("AI response missing required fields");
  }

  const meta = {
    name: input.name,
    slug: String(parsed.meta.slug ?? input.name),
    description: String(parsed.meta.description ?? input.description),
    project: input.project,
    tags: Array.isArray(parsed.meta.tags) ? (parsed.meta.tags as string[]) : [],
    interpreter: (parsed.meta.interpreter as GeneratedForm["meta"]["interpreter"]) ?? "bash",
    aiProvider: legacyProviderForKind(service.kind),
    aiModel: service.model,
    createdAt: now,
    updatedAt: now,
  };

  const generated: GeneratedForm = {
    meta,
    form: {
      fields: Array.isArray((parsed.form as { fields?: unknown }).fields)
        ? (parsed.form as { fields: GeneratedForm["form"]["fields"] }).fields
        : [],
      aiPromptField: (parsed.form as { aiPromptField?: boolean }).aiPromptField === true,
      outputType: (parsed.form as { outputType?: GeneratedForm["form"]["outputType"] }).outputType ?? "text",
      scriptFile: `script.${parsed.scriptExtension ?? "sh"}`,
    },
    script: parsed.script,
    scriptExtension: String(parsed.scriptExtension ?? "sh"),
    dependencyCheck: typeof parsed.dependencyCheck === "string" ? parsed.dependencyCheck : undefined,
    installInstructions: typeof parsed.installInstructions === "string" ? parsed.installInstructions : undefined,
  };

  return generated;
}

/**
 * Run the generated dependency-check command. Returns the name of the missing
 * dependency if the check reports one, else null.
 */
export async function runDependencyCheck(generated: GeneratedForm): Promise<string | null> {
  if (!generated.dependencyCheck) return null;
  try {
    const proc = Bun.spawn(["bash", "-c", generated.dependencyCheck], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    const out = (await new Response(proc.stdout).text()).trim();
    const match = out.match(/MISSING:\s*(\S+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
