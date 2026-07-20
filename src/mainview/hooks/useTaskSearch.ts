import { useMemo } from "react";
import type { TaskFolder } from "../types/tasks";

function rank(query: string, task: TaskFolder): number {
  const q = query.toLowerCase();
  const name = task.meta.name.toLowerCase();
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.includes(q)) return 2;
  if (task.meta.project.toLowerCase().includes(q)) return 3;
  if (task.meta.tags.some((t) => t.toLowerCase().includes(q))) return 4;
  if (task.meta.description.toLowerCase().includes(q)) return 5;
  return Number.POSITIVE_INFINITY;
}

/**
 * Filters and ranks tasks for the command palette. When the query is empty the
 * most recently used tasks are surfaced first (last 5), followed by the rest.
 */
export function useTaskSearch(tasks: TaskFolder[], query: string, recentSlugs: string[]): TaskFolder[] {
  return useMemo(() => {
    if (query.trim() === "") {
      const recent = recentSlugs
        .map((slug) => tasks.find((t) => t.meta.slug === slug))
        .filter((t): t is TaskFolder => t !== undefined);
      const recentSet = new Set(recent.map((t) => t.meta.slug));
      const rest = tasks.filter((t) => !recentSet.has(t.meta.slug));
      return [...recent, ...rest].slice(0, 20);
    }

    return tasks
      .map((task) => ({ task, score: rank(query, task) }))
      .filter((e) => Number.isFinite(e.score))
      .sort((a, b) => a.score - b.score)
      .slice(0, 20)
      .map((e) => e.task);
  }, [tasks, query, recentSlugs]);
}
