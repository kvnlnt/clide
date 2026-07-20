import type { RunRecord, TaskFolder, ThreadViewFilters } from "./types";

/** AND across filter entries (chips); OR within a single entry's values. */
export function matchesView(run: RunRecord, filters: ThreadViewFilters, tasksBySlug: Map<string, TaskFolder>): boolean {
  const entries = filters.entries ?? [];
  for (const entry of entries) {
    if (entry.values.length === 0) continue;
    if (entry.type === "task") {
      if (!entry.values.includes(run.taskSlug)) return false;
    } else if (entry.type === "status") {
      if (!entry.values.includes(run.status)) return false;
    } else {
      const name = tasksBySlug.get(run.taskSlug)?.meta.name.toLowerCase() ?? "";
      const inputs = JSON.stringify(run.inputs ?? {}).toLowerCase();
      const isMatch = entry.values.some((k) => {
        const q = k.trim().toLowerCase();
        return q !== "" && (name.includes(q) || inputs.includes(q));
      });
      if (!isMatch) return false;
    }
  }
  return true;
}
