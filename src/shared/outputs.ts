import type { Extraction, OutputDefinition, OutputResult, OutputTransform } from "./types";

export interface CapturedOutput {
  stdout: string;
  stderr: string;
}

/** Walks a dot-path into a parsed JSON value; undefined when any segment is missing. */
function walkJsonPath(value: unknown, path: string): unknown {
  let cur: unknown = value;
  for (const seg of path.split(".").filter(Boolean)) {
    if (Array.isArray(cur) && /^\d+$/.test(seg)) {
      cur = cur[Number(seg)];
      continue;
    }
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function extract(extraction: Extraction, captured: CapturedOutput): { ok: boolean; value?: unknown; error?: string } {
  const text = extraction.source === "stderr" ? captured.stderr : captured.stdout;
  const sel = extraction.selector;

  switch (sel.type) {
    case "whole":
      return { ok: true, value: text };
    case "lines": {
      const lines = text.split("\n");
      const from = Math.max(0, (sel.from ?? 1) - 1);
      const to = sel.to ?? lines.length;
      return { ok: true, value: lines.slice(from, to).join("\n") };
    }
    case "regex": {
      let re: RegExp;
      try {
        re = new RegExp(sel.pattern, "m");
      } catch (err) {
        return { ok: false, error: `invalid pattern: ${String(err)}` };
      }
      const match = re.exec(text);
      if (!match) return { ok: false, error: "pattern didn't match the output" };
      const group = sel.group ?? (match.length > 1 ? 1 : 0);
      const value = match[group];
      if (value === undefined) return { ok: false, error: `pattern has no capture group ${group}` };
      return { ok: true, value };
    }
    case "jsonPath": {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return { ok: false, error: "output wasn't valid JSON" };
      }
      const value = walkJsonPath(parsed, sel.path);
      if (value === undefined) return { ok: false, error: `nothing at JSON path "${sel.path}"` };
      return { ok: true, value };
    }
    case "lastPathLine": {
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("/"));
      const last = lines[lines.length - 1];
      if (!last) return { ok: false, error: "no file path found in the output" };
      return { ok: true, value: last };
    }
  }
}

function applyTransform(value: unknown, t: OutputTransform): { ok: boolean; value?: unknown; error?: string } {
  switch (t.type) {
    case "trim":
      return { ok: true, value: typeof value === "string" ? value.trim() : value };
    case "parseNumber": {
      const n = typeof value === "number" ? value : Number(String(value).trim());
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: `"${String(value)}" isn't a number` };
    }
    case "template": {
      const str = t.template.replace(/\{\{\s*value\s*\}\}/g, typeof value === "string" ? value : JSON.stringify(value));
      return { ok: true, value: str };
    }
    case "pickKeys": {
      const pickOne = (obj: unknown): unknown => {
        if (typeof obj !== "object" || obj === null) return obj;
        const src = obj as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const [from, to] of Object.entries(t.mapping)) {
          if (from in src) out[to] = src[from];
        }
        return out;
      };
      if (Array.isArray(value)) return { ok: true, value: value.map(pickOne) };
      if (typeof value !== "object" || value === null) return { ok: false, error: "pick keys needs a JSON object" };
      return { ok: true, value: pickOne(value) };
    }
  }
}

/**
 * Evaluates a form's output definitions against captured output (ticket 77).
 * Pure and deterministic — shared by the runner (real runs), the wizard's
 * live test, and the workflow engine, so extraction can never behave
 * differently in preview vs. execution. A failing selector yields
 * `ok: false` with a human-readable error; it never throws and never
 * affects the run itself. `fileExists` (optional, node-side) validates
 * `file`-source values.
 */
export function evaluateOutputs(
  defs: OutputDefinition[],
  captured: CapturedOutput,
  fileExists?: (path: string) => boolean,
): OutputResult[] {
  return defs.map((def) => {
    const base = { id: def.id, name: def.name, kind: def.kind };
    const extracted = extract(def.extraction, captured);
    if (!extracted.ok) return { ...base, ok: false, error: extracted.error };

    let value = extracted.value;
    for (const t of def.transforms ?? []) {
      const res = applyTransform(value, t);
      if (!res.ok) return { ...base, ok: false, error: res.error };
      value = res.value;
    }

    if (def.extraction.source === "file" && fileExists) {
      const path = String(value);
      if (!fileExists(path)) return { ...base, ok: false, error: `file not found: ${path}` };
    }

    return { ...base, ok: true, value };
  });
}
