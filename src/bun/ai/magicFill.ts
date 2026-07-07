import type { AIService, FormField, FormFolder } from "../../shared/types";
import { getDefaultAIService, legacyProviderForKind, listAIServices } from "./aiServices";
import { complete } from "./providers";

/** Max payload text sent to the model as fill context. */
const PAYLOAD_LIMIT = 8192;

/** The form's creation service kind when a matching service exists, else the default service. */
async function resolveService(folder: FormFolder): Promise<AIService | null> {
  const services = await listAIServices();
  if (services.length === 0) return null;
  const preferredKind = folder.meta.aiProvider
    ? services.find((s) => legacyProviderForKind(s.kind) === folder.meta.aiProvider)
    : undefined;
  return preferredKind ?? (await getDefaultAIService()) ?? null;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("AI response did not contain JSON");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

/** Coerce/validate a raw AI fill against the field's type. Returns undefined to drop. */
function validateFill(field: FormField, raw: unknown): unknown {
  switch (field.type) {
    case "select": {
      const value = typeof raw === "string" ? raw.trim() : "";
      return field.options?.includes(value) ? value : undefined;
    }
    case "multicheck": {
      const values = Array.isArray(raw)
        ? raw.filter((v): v is string => typeof v === "string")
        : typeof raw === "string"
          ? raw.split(",").map((v) => v.trim())
          : [];
      const valid = values.filter((v) => field.options?.includes(v));
      return valid.length > 0 ? valid : undefined;
    }
    case "number": {
      const num = typeof raw === "number" ? raw : Number(String(raw).trim());
      return Number.isFinite(num) ? num : undefined;
    }
    case "date": {
      const str = typeof raw === "string" ? raw.trim() : "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
      const parsed = new Date(str);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
    }
    default: {
      // text / textarea / file
      if (typeof raw === "string") return raw;
      if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
      return undefined;
    }
  }
}

/**
 * Fill the requested magic fields in one batched AI call. `fields` maps field
 * id → magic prompt; `payload` is the triggering event's output when the fill
 * runs in the auto-submit path. Returns only validated values — fields the AI
 * couldn't fill (or filled invalidly) are simply absent.
 */
export async function fillMagicFields(
  folder: FormFolder,
  fields: Record<string, string>,
  payload?: { text: string; json?: unknown },
): Promise<Record<string, unknown>> {
  const ids = Object.keys(fields);
  if (ids.length === 0) return {};

  const service = await resolveService(folder);
  if (!service) throw new Error("No AI service configured — add one in Settings");

  const fieldSpecs = folder.form.fields
    .filter((f) => ids.includes(f.id))
    .map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      options: f.options,
      prompt: fields[f.id],
      source: f.magic?.source ?? "prompt",
    }));

  const system = [
    "You fill form fields for CLIDE, a shell automation app.",
    "Each field below has an associative prompt describing how to fill it.",
    'Fields with source "event" should derive their value from the event payload context when provided.',
    "Respond ONLY with a single JSON object mapping field id to value, e.g.",
    '{ "target-date": "2026-07-01" }',
    "Rules:",
    "- select fields: the value MUST be one of the listed options.",
    "- multicheck fields: return an array of chosen options.",
    "- number fields: return a number.",
    '- date fields: return "YYYY-MM-DD".',
    "- Omit any field you cannot confidently fill.",
  ].join("\n");

  const user = [
    `Today's date: ${new Date().toISOString()}`,
    `Form: ${folder.meta.name} — ${folder.meta.description}`,
    `Fields to fill:\n${JSON.stringify(fieldSpecs, null, 2)}`,
    ...(payload
      ? [
          `Event payload context:\n${payload.text.slice(0, PAYLOAD_LIMIT)}`,
          ...(payload.json !== undefined
            ? [`Parsed payload JSON:\n${JSON.stringify(payload.json).slice(0, PAYLOAD_LIMIT)}`]
            : []),
        ]
      : []),
  ].join("\n\n");

  const raw = await complete(service, { system, user });
  const parsed = extractJson(raw);
  if (typeof parsed !== "object" || parsed === null) return {};

  const values: Record<string, unknown> = {};
  for (const field of folder.form.fields) {
    if (!ids.includes(field.id)) continue;
    const fill = (parsed as Record<string, unknown>)[field.id];
    if (fill === undefined || fill === null) continue;
    const valid = validateFill(field, fill);
    if (valid !== undefined) values[field.id] = valid;
  }
  return values;
}
