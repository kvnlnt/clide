import type { AIService, ToolSpec } from "../../shared/types";
import { complete } from "./providers";

/** Max help text sent to the model — long `--help`/man dumps (e.g. ffmpeg) get truncated for the call only. */
const HELP_TEXT_LIMIT = 12000;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI response did not contain JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {});

function validateSpec(raw: unknown): ToolSpec {
  const o = obj(raw);
  return {
    description: str(o.description),
    subcommands: arr(o.subcommands)
      .map(obj)
      .map((s) => ({ name: str(s.name), description: str(s.description) }))
      .filter((s) => s.name),
    options: arr(o.options)
      .map(obj)
      .map((opt) => ({
        flags: arr(opt.flags).filter((f): f is string => typeof f === "string"),
        description: str(opt.description),
        takesValue: opt.takesValue === true,
        repeatable: opt.repeatable === true,
      }))
      .filter((opt) => opt.flags.length > 0),
    positionals: arr(o.positionals)
      .map(obj)
      .map((p) => ({ name: str(p.name), description: str(p.description) }))
      .filter((p) => p.name),
    examples: arr(o.examples).filter((e): e is string => typeof e === "string"),
  };
}

const SYSTEM_PROMPT = [
  "You read CLI tool documentation (--help/man output) for CLIDE, an app that wraps installed command-line tools in graphical forms.",
  "Extract its structure. Respond ONLY with a single JSON object of this exact shape:",
  `{
  "description": string,           // one line: what the tool does
  "subcommands": [{ "name": string, "description": string }],
  "options": [{ "flags": string[], "description": string, "takesValue": boolean, "repeatable": boolean }],
  "positionals": [{ "name": string, "description": string }],
  "examples": string[]
}`,
  "Use empty arrays for subcommands/positionals/examples the tool doesn't have. Keep descriptions short (one line each).",
  "\"flags\" lists every spelling of one option together, e.g. [\"-o\", \"--output\"].",
].join("\n");

/**
 * Distills raw --help/man text (or user-pasted docs) into a structured
 * `ToolSpec` using an explicit service + model override — the wizard/Tools
 * page always choose both explicitly rather than relying on a service default.
 */
export async function distillToolSpec(
  toolName: string,
  helpText: string,
  service: AIService,
  model: string,
): Promise<ToolSpec> {
  const user = `Tool name: ${toolName}\n\nDocumentation:\n${helpText.slice(0, HELP_TEXT_LIMIT)}`;
  const raw = await complete({ ...service, model }, { system: SYSTEM_PROMPT, user });
  return validateSpec(extractJson(raw));
}

const SUGGEST_SYSTEM_PROMPT = [
  "The user describes something they want to do on the command line, for CLIDE — an app that wraps installed CLI tools in GUI forms.",
  "Suggest up to 6 common CLI tool executable names (bare names only, no paths, no flags, no explanations) commonly available on macOS/Linux that could accomplish it.",
  'Respond ONLY with JSON: { "tools": string[] }',
].join("\n");

/**
 * One-shot "find a tool" suggestion (wizard step, ticket 54) — the caller
 * verifies each suggestion with `resolveTool` before showing it, since the
 * model may suggest tools that aren't actually installed.
 */
export async function suggestTools(query: string, service: AIService, model: string): Promise<string[]> {
  const raw = await complete({ ...service, model }, { system: SUGGEST_SYSTEM_PROMPT, user: query });
  const parsed = obj(extractJson(raw));
  return arr(parsed.tools)
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.trim());
}
