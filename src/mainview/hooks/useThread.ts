import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import type { FormFolder, RunRecord, ThreadViewFilters } from "../types/forms";

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
 * Coalesce consecutive same-form runs within a sorted run list into RunGroups.
 * When `standalonePinned` is set (inside saved views), pinned runs never merge.
 */
function coalesceRuns(runs: RunRecord[], standalonePinned: boolean): RunGroup[] {
  const groups: RunGroup[] = [];
  for (const run of runs) {
    const last = groups[groups.length - 1];
    if (!(standalonePinned && run.pinned) && last && last.formSlug === run.formSlug) {
      last.runs.push(run);
    } else {
      groups.push({ key: run.id, formSlug: run.formSlug, runs: [run] });
    }
  }
  return groups;
}

/** AND across filter categories; OR within a category's selections. */
function matchesView(run: RunRecord, filters: ThreadViewFilters, formsBySlug: Map<string, FormFolder>): boolean {
  if (filters.formSlugs?.length && !filters.formSlugs.includes(run.formSlug)) return false;
  if (filters.statuses?.length && !filters.statuses.includes(run.status)) return false;
  if (filters.pinnedOnly && !run.pinned) return false;
  const q = filters.query?.trim().toLowerCase();
  if (q) {
    const name = formsBySlug.get(run.formSlug)?.meta.name.toLowerCase() ?? "";
    const inputs = JSON.stringify(run.inputs ?? {}).toLowerCase();
    if (!name.includes(q) && !inputs.includes(q)) return false;
  }
  return true;
}

interface ThreadModel {
  visibleRuns: RunRecord[];
  groups: ThreadGroup[];
  formFor: (slug: string) => FormFolder | undefined;
}

/**
 * Derives the ordered, grouped list of runs for the active project. On the
 * title tab (no active view) the order is purely reverse-chronological —
 * pinning is a view concern. Inside a saved view, pinned runs float to the
 * top under a "Pinned" bucket. Consecutive runs of the same form are
 * coalesced into a single RunGroup.
 */
export function useThread(): ThreadModel {
  const { runs, formsBySlug, activeProject, views, activeViewId } = useApp();

  const activeView = activeViewId ? views.find((v) => v.id === activeViewId) : undefined;
  const inView = activeView !== undefined;

  const visibleRuns = useMemo(() => {
    let filtered = activeProject
      ? runs.filter((r) => formsBySlug.get(r.formSlug)?.meta.project === activeProject)
      : runs;
    if (activeView) {
      filtered = filtered.filter((r) => matchesView(r, activeView.filters, formsBySlug));
    }
    return [...filtered].sort((a, b) => {
      if (inView && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });
  }, [runs, formsBySlug, activeProject, activeView, inView]);

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
    // Second pass: coalesce consecutive same-form runs within each bucket.
    return dateBuckets.map(({ label, runs }) => ({
      label,
      items: coalesceRuns(runs, inView),
    }));
  }, [visibleRuns, inView]);

  return {
    visibleRuns,
    groups,
    formFor: (slug: string) => formsBySlug.get(slug),
  };
}
