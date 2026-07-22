import type { Report } from "./types/tasks";

/**
 * A fresh, empty report (ticket 134). Lives outside ReportEditor/AppContext
 * so both can import it without a circular dependency (AppContext generates
 * it once per "new report" open; ReportEditor never needs to call it itself).
 */
export function blankReport(): Report {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name: "", description: "", members: [], createdAt: now, updatedAt: now };
}
