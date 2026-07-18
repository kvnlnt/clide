import { Plus } from "lucide-react";
import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import SidebarProject from "./SidebarProject";

export default function Sidebar() {
  const { forms, projects, runs, activeProject, setActiveProject, openNewProject } = useApp();

  // Map each form slug to its project so we can attribute runs to projects.
  const slugToProject = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of forms) m.set(f.meta.slug, f.meta.project);
    return m;
  }, [forms]);

  // Unread terminal runs per project (ticket 97): red if any unread error, green otherwise, zero → no badge.
  const counts = useMemo(() => {
    const map = new Map<string, { unreadCount: number; hasError: boolean }>();
    for (const run of runs) {
      const project = slugToProject.get(run.taskSlug);
      if (!project) continue;
      // Only count terminal runs (success or error) that are unread
      if ((run.status === "success" || run.status === "error") && !run.readAt) {
        const entry = map.get(project) ?? { unreadCount: 0, hasError: false };
        entry.unreadCount += 1;
        if (run.status === "error") entry.hasError = true;
        map.set(project, entry);
      }
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
            const badgeCount = c?.unreadCount ?? 0;
            const badgeColor = c?.hasError ? "red" : "green";
            return (
              <SidebarProject
                key={project}
                name={project}
                active={activeProject === project}
                badgeCount={badgeCount}
                badgeColor={badgeColor}
                hasRunning={hasRunning.get(project) ?? false}
                onClick={() => setActiveProject(activeProject === project ? null : project)}
              />
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
