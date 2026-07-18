import type { TaskField } from "./types";

/**
 * Masks secret field values before they reach AI prompts (ticket 98).
 * Returns a new object with secret values replaced by "•••".
 */
export function maskSecrets(values: Record<string, unknown>, fields: TaskField[]): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  const secretIds = new Set(fields.filter((f) => f.secret).map((f) => f.id));

  for (const [key, value] of Object.entries(values)) {
    masked[key] = secretIds.has(key) ? "•••" : value;
  }

  return masked;
}
