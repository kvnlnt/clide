import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import SidebarFooter from "./SidebarFooter";
import SidebarProject from "./SidebarProject";

export default function Sidebar() {
  const { forms, projects, runs, activeProject, setActiveProject, createProject } = useApp();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submitNewProject = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name required");
      return;
    }
    const res = await createProject(trimmed, path.trim() || undefined);
    if (res.ok) {
      setName("");
      setPath("");
      setError(null);
      setAdding(false);
    } else {
      setError(res.error ?? "Failed to create project");
    }
  };

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
    <aside className="flex w-[250px] shrink-0 flex-col p-2.5">
      <div className="flex flex-1 flex-col overflow-hidden rounded-[5px] bg-clide-panel">
        <div className="flex items-center justify-between px-3 py-3">
          <span className="text-[15px] font-bold text-white">CLIDE</span>
          <button
            onClick={() => {
              setAdding((v) => !v);
              setError(null);
            }}
            title="New project"
            className="flex h-6 w-6 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white"
          >
            <Plus size={16} />
          </button>
        </div>
        {adding && (
          <div className="flex flex-col gap-1.5 px-3 pb-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitNewProject();
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder="Project name"
              className="rounded-md border border-clide-border bg-clide-surface px-2 py-1 text-[13px] text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
            />
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitNewProject();
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder="Folder path (optional)"
              className="rounded-md border border-clide-border bg-clide-surface px-2 py-1 text-[12px] text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
            />
            {error && <span className="text-[11px] text-red-400">{error}</span>}
            <div className="flex gap-1.5">
              <button
                onClick={() => void submitNewProject()}
                className="flex-1 rounded-md bg-white/10 px-2 py-1 text-[12px] font-medium text-white hover:bg-white/20"
              >
                Create
              </button>
              <button
                onClick={() => setAdding(false)}
                className="rounded-md px-2 py-1 text-[12px] text-white/50 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        <nav className="clide-scroll flex-1 overflow-y-auto px-1.5">
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
        <div className="border-t border-white/5">
          <SidebarFooter />
        </div>
      </div>
    </aside>
  );
}
