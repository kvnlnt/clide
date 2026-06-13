import type { CreateFormInput, GeneratedForm } from "../../shared/types";
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

/**
 * Ask the configured AI provider to generate a complete form folder (meta, form
 * definition, and script) from the user's name + description.
 */
export async function generateForm(input: CreateFormInput): Promise<GeneratedForm> {
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

  const raw = await complete(input.provider, { system, user }, input.model);
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
