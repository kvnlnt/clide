import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import ProjectSettingsModal from "./ProjectSettingsModal";
import SidebarFooter from "./SidebarFooter";
import SidebarProject from "./SidebarProject";

export default function Sidebar() {
  const {
    forms,
    projects,
    projectMeta,
    runs,
    activeProject,
    setActiveProject,
    openNewProject,
    toggleSidebar,
    sidebarOpen,
  } = useApp();
  const [editingPath, setEditingPath] = useState<string | null>(null);

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
      if (
        run.status === "running" ||
        run.status === "pending" ||
        run.status === "scheduled"
      ) {
        entry.active += 1;
      } else if (run.status === "error") {
        entry.error += 1;
      }
      map.set(project, entry);
    }
    return map;
  }, [runs, slugToProject]);

  // Map registered project names to their folder paths (for rename/delete).
  const nameToPath = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projectMeta) m.set(p.name, p.path);
    return m;
  }, [projectMeta]);

  // The project currently being edited (resolved from path back to name).
  const editingProject = useMemo(() => {
    if (!editingPath) return null;
    const meta = projectMeta.find((p) => p.path === editingPath);
    return meta ? { path: meta.path, name: meta.name } : null;
  }, [editingPath, projectMeta]);

  return (
    <aside className="flex w-[250px] shrink-0 flex-col p-2.5">
      <div className="flex flex-1 flex-col overflow-hidden rounded-[5px] bg-clide-panel">
        <div className="flex items-center justify-between px-3 py-3">
          <span className="text-[15px] font-bold text-white">CLIDE</span>
          <button
            onClick={openNewProject}
            title="Add project"
            className="flex h-6 w-6 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white"
          >
            <Plus size={16} />
          </button>
        </div>
        <nav className="clide-scroll flex-1 overflow-y-auto px-1.5">
          {projects.length === 0 && (
            <div className="px-2 py-2 text-[13px] text-white/30">
              No projects yet
            </div>
          )}
          {projects.map((project) => {
            const c = counts.get(project);
            const badgeCount = c ? c.active || c.error : 0;
            const badgeColor = c && c.active > 0 ? "green" : "red";
            const projectPath = nameToPath.get(project) ?? null;
            return (
              <SidebarProject
                key={project}
                name={project}
                active={activeProject === project}
                badgeCount={badgeCount}
                badgeColor={badgeColor}
                canEdit={projectPath !== null}
                onClick={() =>
                  setActiveProject(activeProject === project ? null : project)
                }
                onOpenSettings={() =>
                  setEditingPath((cur) =>
                    cur === projectPath ? null : projectPath,
                  )
                }
              />
            );
          })}
        </nav>
        <div className="border-t border-white/5">
          <SidebarFooter />
        </div>
      </div>
      {editingProject && (
        <ProjectSettingsModal
          path={editingProject.path}
          name={editingProject.name}
          onClose={() => setEditingPath(null)}
        />
      )}
    </aside>
  );
}
