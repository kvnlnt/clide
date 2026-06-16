import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import type { FormFolder, RunRecord } from "../types/forms";

/** One or more consecutive same-form runs coalesced into a single card unit. */
export interface RunGroup {
  /** Stable identity — the latest (newest) run's id. */
  key: string;
  formSlug: string;
  /** Newest first; length >= 1. */
  runs: RunRecord[];
}

export interface ThreadGroup {
  label: string;
  items: RunGroup[];
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Coalesce consecutive same-form, non-pinned runs within a sorted run list into RunGroups. */
function coalesceRuns(runs: RunRecord[]): RunGroup[] {
  const groups: RunGroup[] = [];
  for (const run of runs) {
    const last = groups[groups.length - 1];
    // Pinned runs always stand alone; non-pinned runs merge if same form as last group.
    if (!run.pinned && last && last.formSlug === run.formSlug) {
      last.runs.push(run);
    } else {
      groups.push({ key: run.id, formSlug: run.formSlug, runs: [run] });
    }
  }
  return groups;
}

interface ThreadModel {
  visibleRuns: RunRecord[];
  groups: ThreadGroup[];
  formFor: (slug: string) => FormFolder | undefined;
}

/**
 * Derives the ordered, grouped list of runs for the active project. Pinned runs
 * float to the top, followed by reverse-chronological history grouped by date.
 * Consecutive runs of the same form are coalesced into a single RunGroup.
 */
export function useThread(): ThreadModel {
  const { runs, formsBySlug, activeProject } = useApp();

  const visibleRuns = useMemo(() => {
    const filtered = activeProject
      ? runs.filter(
          (r) => formsBySlug.get(r.formSlug)?.meta.project === activeProject,
        )
      : runs;
    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });
  }, [runs, formsBySlug, activeProject]);

  const groups = useMemo(() => {
    // First pass: bucket by date label (same as before).
    const dateBuckets: { label: string; runs: RunRecord[] }[] = [];
    let currentBucket: { label: string; runs: RunRecord[] } | null = null;
    for (const run of visibleRuns) {
      const label = run.pinned ? "Pinned" : dateLabel(run.startedAt);
      if (!currentBucket || currentBucket.label !== label) {
        currentBucket = { label, runs: [] };
        dateBuckets.push(currentBucket);
      }
      currentBucket.runs.push(run);
    }
    // Second pass: coalesce consecutive same-form runs within each bucket.
    return dateBuckets.map(({ label, runs }) => ({
      label,
      items: coalesceRuns(runs),
    }));
  }, [visibleRuns]);

  return {
    visibleRuns,
    groups,
    formFor: (slug: string) => formsBySlug.get(slug),
  };
}
