import type { AIService, ArgMapping, ArgMappingKind, FieldType, TaskField, ToolSpec } from "../../shared/types";
import { complete } from "./providers";

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI response did not contain JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const FIELD_TYPES: FieldType[] = ["text", "textarea", "select", "multicheck", "number", "file", "date"];
const ARG_MAPPING_KINDS: ArgMappingKind[] = ["flag", "option", "positional", "env", "stdin"];

function validateArgMapping(raw: unknown): ArgMapping | undefined {
  if (!isObject(raw) || !ARG_MAPPING_KINDS.includes(raw.kind as ArgMappingKind)) return undefined;
  return {
    kind: raw.kind as ArgMappingKind,
    flag: typeof raw.flag === "string" ? raw.flag : undefined,
    style: raw.style === "equals" ? "equals" : "space",
    order: typeof raw.order === "number" ? raw.order : undefined,
    repeat: raw.repeat === true,
  };
}

function validateField(raw: unknown, index: number): TaskField | null {
  if (!isObject(raw)) return null;
  const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : null;
  if (!label) return null;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `field-${index + 1}`;
  const type = FIELD_TYPES.includes(raw.type as FieldType) ? (raw.type as FieldType) : "text";
  return {
    id,
    label,
    type,
    description: typeof raw.description === "string" && raw.description.trim() ? raw.description.trim() : undefined,
    required: raw.required === true,
    options: Array.isArray(raw.options) ? raw.options.filter((o): o is string => typeof o === "string") : undefined,
    argMapping: validateArgMapping(raw.argMapping),
  };
}

const SYSTEM_PROMPT = [
  "You design a GUI form for CLIDE, which wraps ONE action of an installed CLI tool as a form.",
  "The user has stated a goal for the form. Follow the Unix philosophy: the form does one thing well. Only include fields for the options/positionals the stated goal actually needs — do not include every flag the tool has.",
  'Respond ONLY with a single JSON object: { "fields": FormField[] } where each FormField is:',
  `{
  "id": string (kebab-case, unique),
  "label": string (human-friendly),
  "description": string (one short sentence of help text for the user),
  "type": "text" | "textarea" | "select" | "multicheck" | "number" | "file" | "date",
  "required": boolean,
  "options": string[] (only for select/multicheck),
  "argMapping": {
    "kind": "flag" | "option" | "positional" | "env" | "stdin",
    "flag": string (for flag/option, e.g. "--output"; omit for positional/env/stdin),
    "style": "space" | "equals" (option only, default "space"),
    "order": number (positional only, ascending),
    "repeat": boolean (option/positional only, when the field can hold multiple values)
  }
}`,
  'Use "file" type for filesystem paths. Every field must have an argMapping — this is how the form becomes a real command.',
].join("\n");

/**
 * Drafts a field set for one scoped action of a tool from the user's stated
 * goal plus the tool's distilled ToolSpec (tickets 54/61) — the wizard's
 * AI-assist step. Fully overridable afterward; this only produces a starting
 * point.
 */
export async function draftCommandFields(
  goal: string,
  toolName: string,
  actionName: string,
  spec: ToolSpec,
  service: AIService,
  model: string,
): Promise<TaskField[]> {
  const user = [
    `The form's goal, as stated by the user: ${goal}`,
    `Tool: ${toolName}`,
    `Action: ${actionName}`,
    `Tool spec:\n${JSON.stringify(spec, null, 2)}`,
  ].join("\n\n");
  const raw = await complete({ ...service, model }, { system: SYSTEM_PROMPT, user });
  const parsed = extractJson(raw);
  const list = isObject(parsed) && Array.isArray(parsed.fields) ? parsed.fields : [];
  return list.map(validateField).filter((f): f is TaskField => f !== null);
}
