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

  // Pending/running run counts per project (badge counts).
  const counts = useMemo(() => {
    const map = new Map<string, { active: number; error: number }>();
    for (const run of runs) {
      const project = slugToProject.get(run.formSlug);
      if (!project) continue;
      const entry = map.get(project) ?? { active: 0, error: 0 };
      if (run.status === "running" || run.status === "pending" || run.status === "scheduled") {
        entry.active += 1;
      } else if (run.status === "error") {
        entry.error += 1;
      }
      map.set(project, entry);
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
            const badgeCount = c ? c.active || c.error : 0;
            const badgeColor = c && c.active > 0 ? "green" : "red";
            return (
              <SidebarProject
                key={project}
                name={project}
                active={activeProject === project}
                badgeCount={badgeCount}
                badgeColor={badgeColor}
                onClick={() => setActiveProject(activeProject === project ? null : project)}
              />
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
