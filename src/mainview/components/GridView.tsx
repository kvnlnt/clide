import { LayoutGrid, List } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../rpc";
import type { GridCardSize, ProjectLayout, RunRecord } from "../types/tasks";
import GridCard from "./GridCard";

const SIZE_CYCLE: GridCardSize[] = ["small", "medium", "large"];

export default function GridView() {
  const { tasks, activeProject, runs, submitRun, addTaskDraft } = useApp();

  // Ticket 20: grid view is retired from the render path and the list/grid
  // toggle no longer exists in AppContext. Stub it locally so this dead
  // component stays compilable until grid returns (see ticket 19).
  const viewMode = "grid" as "list" | "grid";
  const setViewMode = (_m: "list" | "grid") => {};

  const projectSlug = activeProject ?? "all";

  const projectTasks = useMemo(
    () => (activeProject ? tasks.filter((f) => f.meta.project === activeProject) : tasks),
    [tasks, activeProject],
  );

  const [order, setOrder] = useState<string[]>([]);
  const [sizes, setSizes] = useState<Record<string, GridCardSize>>({});
  const [dragging, setDragging] = useState<string | null>(null);

  // Load persisted layout whenever the project or its task set changes.
  useEffect(() => {
    let cancelled = false;
    void api.getLayout(projectSlug).then((layout) => {
      if (cancelled) return;
      const slugs = projectTasks.map((f) => f.meta.slug);
      const ordered = layout.cards
        .sort((a, b) => a.position - b.position)
        .map((c) => c.taskSlug)
        .filter((s) => slugs.includes(s));
      const missing = slugs.filter((s) => !ordered.includes(s));
      setOrder([...ordered, ...missing]);
      const sizeMap: Record<string, GridCardSize> = {};
      for (const c of layout.cards) sizeMap[c.taskSlug] = c.size;
      setSizes(sizeMap);
    });
    return () => {
      cancelled = true;
    };
  }, [projectSlug, projectTasks]);

  const lastRunBySlug = useMemo(() => {
    const m = new Map<string, RunRecord>();
    for (const run of runs) {
      if (!m.has(run.taskSlug)) m.set(run.taskSlug, run);
    }
    return m;
  }, [runs]);

  const pinnedSlugs = useMemo(() => {
    const set = new Set<string>();
    for (const run of runs) if (run.pinned) set.add(run.taskSlug);
    return set;
  }, [runs]);

  const persist = useCallback(
    (nextOrder: string[], nextSizes: Record<string, GridCardSize>) => {
      const layout: ProjectLayout = {
        cards: nextOrder.map((slug, i) => ({
          taskSlug: slug,
          size: nextSizes[slug] ?? "small",
          position: i,
        })),
      };
      void api.saveLayout(projectSlug, layout);
    },
    [projectSlug],
  );

  // Pinned tasks float to the first row.
  const displayOrder = useMemo(() => {
    const present = order.filter((s) => projectTasks.some((f) => f.meta.slug === s));
    return [...present].sort((a, b) => {
      const pa = pinnedSlugs.has(a) ? 0 : 1;
      const pb = pinnedSlugs.has(b) ? 0 : 1;
      return pa - pb;
    });
  }, [order, projectTasks, pinnedSlugs]);

  const handleDrop = (targetSlug: string) => {
    if (!dragging || dragging === targetSlug) return;
    const next = [...order];
    const from = next.indexOf(dragging);
    const to = next.indexOf(targetSlug);
    if (from === -1 || to === -1) return;
    next.splice(from, 1);
    next.splice(to, 0, dragging);
    setOrder(next);
    persist(next, sizes);
    setDragging(null);
  };

  const cycleSize = (slug: string) => {
    const current = sizes[slug] ?? "small";
    const next = SIZE_CYCLE[(SIZE_CYCLE.indexOf(current) + 1) % SIZE_CYCLE.length];
    const nextSizes = { ...sizes, [slug]: next };
    setSizes(nextSizes);
    persist(order, nextSizes);
  };

  const openTask = (slug: string) => {
    addTaskDraft(slug);
    setViewMode("list");
  };

  const quickRun = (slug: string) => {
    const folder = projectTasks.find((f) => f.meta.slug === slug);
    const hasRequired = folder?.task.fields.some((f) => f.required);
    if (hasRequired) {
      openTask(slug);
    } else {
      void submitRun(slug, {});
      setViewMode("list");
    }
  };

  return (
    <div className="clide-scroll flex-1 overflow-y-auto">
      <div className="flex justify-end p-3">
        <button
          className="text-white/30 transition-colors hover:text-white flex items-center justify-center rounded-full"
          onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
          title="Toggle view"
        >
          {viewMode === "list" ? <List size={18} /> : <LayoutGrid size={18} />}
        </button>
      </div>
      {displayOrder.length === 0 ? (
        <div className="flex h-full items-center justify-center text-[14px] italic text-white/30">
          No tasks in this project
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3  pl-1.5 pr-3">
          {displayOrder.map((slug) => {
            const folder = projectTasks.find((f) => f.meta.slug === slug);
            if (!folder) return null;
            return (
              <GridCard
                key={slug}
                task={folder}
                size={sizes[slug] ?? "small"}
                lastRun={lastRunBySlug.get(slug)}
                pinned={pinnedSlugs.has(slug)}
                onOpen={() => openTask(slug)}
                onQuickRun={() => quickRun(slug)}
                onCycleSize={() => cycleSize(slug)}
                onDragStart={() => setDragging(slug)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(slug)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
