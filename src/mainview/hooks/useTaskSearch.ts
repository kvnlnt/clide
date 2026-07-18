import { useMemo } from "react";
import type { TaskFolder } from "../types/tasks";

function rank(query: string, form: TaskFolder): number {
  const q = query.toLowerCase();
  const name = form.meta.name.toLowerCase();
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.includes(q)) return 2;
  if (form.meta.project.toLowerCase().includes(q)) return 3;
  if (form.meta.tags.some((t) => t.toLowerCase().includes(q))) return 4;
  if (form.meta.description.toLowerCase().includes(q)) return 5;
  return Number.POSITIVE_INFINITY;
}

/**
 * Filters and ranks forms for the command palette. When the query is empty the
 * most recently used forms are surfaced first (last 5), followed by the rest.
 */
export function useTaskSearch(forms: TaskFolder[], query: string, recentSlugs: string[]): TaskFolder[] {
  return useMemo(() => {
    if (query.trim() === "") {
      const recent = recentSlugs
        .map((slug) => forms.find((f) => f.meta.slug === slug))
        .filter((f): f is TaskFolder => f !== undefined);
      const recentSet = new Set(recent.map((f) => f.meta.slug));
      const rest = forms.filter((f) => !recentSet.has(f.meta.slug));
      return [...recent, ...rest].slice(0, 20);
    }

    return forms
      .map((form) => ({ form, score: rank(query, form) }))
      .filter((e) => Number.isFinite(e.score))
      .sort((a, b) => a.score - b.score)
      .slice(0, 20)
      .map((e) => e.form);
  }, [forms, query, recentSlugs]);
}
