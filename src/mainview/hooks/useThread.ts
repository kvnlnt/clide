import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import type { RunRecord, TaskFolder, ThreadViewFilters } from "../types/tasks";

/** One or more consecutive same-task runs coalesced into a single card unit. */
export interface RunGroup {
  /** Stable identity — the latest (newest) run's id. */
  key: string;
  taskSlug: string;
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

/**
 * Coalesce consecutive same-task runs within a sorted run list into RunGroups.
 * When `standalonePinned` is set (inside saved views), pinned runs never merge.
 */
function coalesceRuns(runs: RunRecord[], standalonePinned: boolean): RunGroup[] {
  const groups: RunGroup[] = [];
  for (const run of runs) {
    const last = groups[groups.length - 1];
    if (!(standalonePinned && run.pinned) && last && last.taskSlug === run.taskSlug) {
      last.runs.push(run);
    } else {
      groups.push({ key: run.id, taskSlug: run.taskSlug, runs: [run] });
    }
  }
  return groups;
}

/** AND across filter entries (chips); OR within a single entry's values. */
function matchesView(run: RunRecord, filters: ThreadViewFilters, tasksBySlug: Map<string, TaskFolder>): boolean {
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

interface ThreadModel {
  visibleRuns: RunRecord[];
  groups: ThreadGroup[];
  formFor: (slug: string) => TaskFolder | undefined;
}

/**
 * Derives the ordered, grouped list of runs for the active project. On the
 * title tab (no active view) the order is purely reverse-chronological —
 * pinning is a view concern. Inside a saved view, pinned runs float to the
 * top under a "Pinned" bucket. Consecutive runs of the same task are
 * coalesced into a single RunGroup.
 */
export function useThread(): ThreadModel {
  const { runs, tasksBySlug, activeProject, views, activeViewId } = useApp();

  const activeView = activeViewId ? views.find((v) => v.id === activeViewId) : undefined;
  const inView = activeView !== undefined;

  const visibleRuns = useMemo(() => {
    let filtered = activeProject
      ? runs.filter((r) => tasksBySlug.get(r.taskSlug)?.meta.project === activeProject)
      : runs;
    if (activeView) {
      filtered = filtered.filter((r) => matchesView(r, activeView.filters, tasksBySlug));
    }
    return [...filtered].sort((a, b) => {
      if (inView && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });
  }, [runs, tasksBySlug, activeProject, activeView, inView]);

  const groups = useMemo(() => {
    // First pass: bucket by date label (pinned bucket only inside views).
    const dateBuckets: { label: string; runs: RunRecord[] }[] = [];
    let currentBucket: { label: string; runs: RunRecord[] } | null = null;
    for (const run of visibleRuns) {
      const label = inView && run.pinned ? "Pinned" : dateLabel(run.startedAt);
      if (!currentBucket || currentBucket.label !== label) {
        currentBucket = { label, runs: [] };
        dateBuckets.push(currentBucket);
      }
      currentBucket.runs.push(run);
    }
    // Second pass: coalesce consecutive same-task runs within each bucket.
    return dateBuckets.map(({ label, runs }) => ({
      label,
      items: coalesceRuns(runs, inView),
    }));
  }, [visibleRuns, inView]);

  return {
    visibleRuns,
    groups,
    formFor: (slug: string) => tasksBySlug.get(slug),
  };
}
