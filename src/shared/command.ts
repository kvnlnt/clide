import type { ArgMapping, FormDefinition, FormField } from "./types";

export interface BuiltCommand {
  tool: string;
  argv: string[];
  env: Record<string, string>;
  /** stdin content, from the (at most one) field mapped `kind: "stdin"`. */
  stdin?: string;
}

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function tokensFor(field: FormField, mapping: ArgMapping, value: unknown): string[] {
  const flag = mapping.flag ?? `--${field.id}`;
  if (mapping.kind === "flag") {
    return value ? [flag] : [];
  }
  const values = Array.isArray(value) ? value.map(String) : [String(value)];
  if (mapping.kind === "positional") {
    return values;
  }
  // "option"
  if (mapping.repeat) {
    return values.flatMap((v) => (mapping.style === "equals" ? [`${flag}=${v}`] : [flag, v]));
  }
  const joined = values.join(",");
  return mapping.style === "equals" ? [`${flag}=${joined}`] : [flag, joined];
}

/**
 * Builds the exact argv (plus env/stdin) for a command-backed form given its
 * current field values. Pure and side-effect-free — shared by the runner
 * (actual execution) and the UI (live command preview), so what the user
 * sees is always what will run.
 *
 * Ordering: baseArgs, then options/flags in field-declaration order, then
 * positionals sorted by their `order` (most CLI parsers tolerate options
 * anywhere, so this keeps the common case simple and predictable).
 */
export function buildCommand(form: FormDefinition, inputs: Record<string, unknown>): BuiltCommand {
  const command = form.command;
  if (!command) throw new Error("buildCommand called on a form with no command spec");

  const optionTokens: string[] = [];
  const positionals: { order: number; tokens: string[] }[] = [];
  const env: Record<string, string> = {};
  let stdin: string | undefined;

  form.fields.forEach((field, index) => {
    const mapping = field.argMapping;
    if (!mapping) return;
    const value = inputs[field.id];
    const empty = isEmptyValue(value);

    if (mapping.kind === "env") {
      if (!empty) env[mapping.envName ?? field.id.toUpperCase()] = Array.isArray(value) ? value.join(",") : String(value);
      return;
    }
    if (mapping.kind === "stdin") {
      if (!empty && stdin === undefined) stdin = Array.isArray(value) ? value.join("\n") : String(value);
      return;
    }
    if (mapping.kind === "flag") {
      optionTokens.push(...tokensFor(field, mapping, value));
      return;
    }
    if (empty) return;
    if (mapping.kind === "option") {
      optionTokens.push(...tokensFor(field, mapping, value));
    } else {
      positionals.push({ order: mapping.order ?? index, tokens: tokensFor(field, mapping, value) });
    }
  });

  positionals.sort((a, b) => a.order - b.order);
  const argv = [...command.baseArgs, ...optionTokens, ...positionals.flatMap((p) => p.tokens)];

  return { tool: command.tool, argv, env, stdin };
}

const NEEDS_QUOTING = /[\s"'\\$`|&;<>(){}*?~!#]/;

/** Shell-quotes a single argv token for display purposes only — never used to actually spawn. */
function quoteToken(token: string): string {
  if (token === "" || NEEDS_QUOTING.test(token)) return `'${token.replace(/'/g, `'\\''`)}'`;
  return token;
}

/** Renders `tool argv…` as a copyable, shell-quoted command line for previews. */
export function formatCommandPreview(tool: string, argv: string[]): string {
  return [tool, ...argv].map(quoteToken).join(" ");
}
