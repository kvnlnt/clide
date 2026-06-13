import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import type { FormFolder, RunRecord } from "../types/forms";

export interface ThreadGroup {
  label: string;
  runs: RunRecord[];
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface ThreadModel {
  visibleRuns: RunRecord[];
  groups: ThreadGroup[];
  formFor: (slug: string) => FormFolder | undefined;
}

/**
 * Derives the ordered, grouped list of runs for the active project. Pinned runs
 * float to the top, followed by reverse-chronological history grouped by date.
 */
export function useThread(): ThreadModel {
  const { runs, formsBySlug, activeProject } = useApp();

  const visibleRuns = useMemo(() => {
    const filtered = activeProject
      ? runs.filter((r) => formsBySlug.get(r.formSlug)?.meta.project === activeProject)
      : runs;
    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });
  }, [runs, formsBySlug, activeProject]);

  const groups = useMemo(() => {
    const result: ThreadGroup[] = [];
    let current: ThreadGroup | null = null;
    for (const run of visibleRuns) {
      const label = run.pinned ? "Pinned" : dateLabel(run.startedAt);
      if (!current || current.label !== label) {
        current = { label, runs: [] };
        result.push(current);
      }
      current.runs.push(run);
    }
    return result;
  }, [visibleRuns]);

  return {
    visibleRuns,
    groups,
    formFor: (slug: string) => formsBySlug.get(slug),
  };
}
