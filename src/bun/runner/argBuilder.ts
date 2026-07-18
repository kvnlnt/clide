import type { TaskDefinition } from "../../shared/types";

/**
 * Build the argv array (excluding the interpreter + script path) for a form run
 * from the form's field definitions and the user-supplied values.
 *
 * Each field may declare an `argTemplate` such as `--post {{value}}` (single
 * value) or `--platforms {{values}}` (multi value). Values are passed as
 * discrete argv entries — no shell string is constructed — so there is no shell
 * injection surface.
 */
export function buildArgs(form: TaskDefinition, inputs: Record<string, unknown>): string[] {
  const args: string[] = [];

  for (const field of form.fields) {
    const value = inputs[field.id];
    if (value === undefined || value === null || value === "") continue;

    const template = field.argTemplate;
    if (!template) {
      // No template: pass the raw value(s) as positional args.
      if (Array.isArray(value)) args.push(...value.map(String));
      else args.push(String(value));
      continue;
    }

    if (template.includes("{{values}}")) {
      const values = Array.isArray(value) ? value.map(String) : [String(value)];
      if (values.length === 0) continue;
      const prefix = template.replace("{{values}}", "").trim();
      if (prefix) args.push(...prefix.split(/\s+/));
      args.push(...values);
    } else if (template.includes("{{value}}")) {
      const v = Array.isArray(value) ? value.join(", ") : String(value);
      // Split the template on the placeholder, pushing literal flag tokens and
      // the value as separate argv entries.
      const [before, after] = template.split("{{value}}");
      const beforeTokens = before.trim() ? before.trim().split(/\s+/) : [];
      args.push(...beforeTokens);
      args.push(v);
      if (after.trim()) args.push(...after.trim().split(/\s+/));
    } else {
      // Static template with no placeholder.
      args.push(...template.trim().split(/\s+/));
    }
  }

  return args;
}
