import { Plus } from "lucide-react";
import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import SidebarProject from "./SidebarProject";

/** Coarse "latest Nm ago" note for the sidebar row's second line (ticket 126). */
function formatRecency(iso: string | null): string | null {
  if (!iso) return null;
  const deltaMs = Date.now() - new Date(iso).getTime();
  if (deltaMs < 0) return "just now";
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Sidebar() {
  const { tasks, projects, runs, activeProject, setActiveProject, openNewProject, markProjectRunsRead } = useApp();

  // Map each task slug to its project so we can attribute runs to projects.
  const slugToProject = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of tasks) m.set(f.meta.slug, f.meta.project);
    return m;
  }, [tasks]);

  // Type-split unread rollup per project (ticket 126): separate success/error
  // counts instead of one number whose color flips on hasError. A third
  // "needs attention" bucket (partial success/timeout) was considered but
  // RunStatus only distinguishes success/error/in-flight states, so there's
  // nothing cheap to split out — skipped per ticket 126 §1.
  // Also tracks the most recent run's timestamp for the "latest Nm ago" note.
  const counts = useMemo(() => {
    const map = new Map<string, { unreadSuccess: number; unreadError: number; latest: string | null }>();
    for (const run of runs) {
      const project = slugToProject.get(run.taskSlug);
      if (!project) continue;
      const entry = map.get(project) ?? { unreadSuccess: 0, unreadError: 0, latest: null };
      const runTime = run.finishedAt ?? run.startedAt;
      if (!entry.latest || runTime > entry.latest) entry.latest = runTime;
      // Only count terminal runs (success or error) that are unread
      if ((run.status === "success" || run.status === "error") && !run.readAt) {
        if (run.status === "error") entry.unreadError += 1;
        else entry.unreadSuccess += 1;
      }
      map.set(project, entry);
    }
    return map;
  }, [runs, slugToProject]);

  // Keep a small pulsing dot for in-flight runs (ticket 97 §4 decision).
  const hasRunning = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const run of runs) {
      const project = slugToProject.get(run.taskSlug);
      if (!project) continue;
      if (run.status === "running" || run.status === "pending" || run.status === "scheduled") {
        map.set(project, true);
      }
    }
    return map;
  }, [runs, slugToProject]);

  return (
    <aside className="flex w-[230px] shrink-0 flex-col pl-2">
      <div className="flex flex-1 flex-col overflow-hidden rounded-[10px] border border-white/10">
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Projects</span>
          <button
            onClick={openNewProject}
            title="New project"
            className="flex h-5 w-5 items-center justify-center rounded-full text-white/30 transition-colors hover:text-white"
          >
            <Plus size={15} />
          </button>
        </div>
        <nav className="clide-scroll flex-1 overflow-y-auto p-1.5">
          {projects.length === 0 && <div className="px-2 py-2 text-[13px] text-white/30">No projects yet</div>}
          {projects.map((project) => {
            const c = counts.get(project);
            const unreadSuccess = c?.unreadSuccess ?? 0;
            const unreadError = c?.unreadError ?? 0;
            return (
              <SidebarProject
                key={project}
                name={project}
                active={activeProject === project}
                unreadSuccess={unreadSuccess}
                unreadError={unreadError}
                recency={formatRecency(c?.latest ?? null)}
                hasRunning={hasRunning.get(project) ?? false}
                onClick={() => setActiveProject(activeProject === project ? null : project)}
                onMarkRead={unreadSuccess + unreadError > 0 ? () => void markProjectRunsRead(project) : undefined}
              />
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
