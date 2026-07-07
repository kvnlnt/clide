import { FolderOpen, FolderPlus } from "lucide-react";
import { useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../rpc";

const basename = (p: string) => p.split("/").filter(Boolean).pop() ?? p;

/**
 * Branded landing surface shown when no project is active (first launch or
 * after deselecting). Offers the three ways in: create a project, open an
 * existing folder, or jump back into a recent project. Entrance is a staggered
 * rise; the mark carries a slow ambient glow (both respect reduced motion).
 */
export default function WelcomeScreen() {
  const { projects, recentProjects, setActiveProject, openNewProject, createProject } = useApp();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recency-ordered, backfilled with any remaining registered projects.
  const recents = [
    ...recentProjects.filter((p) => projects.includes(p)),
    ...projects.filter((p) => !recentProjects.includes(p)),
  ].slice(0, 5);

  const openExisting = async () => {
    setError(null);
    setOpening(true);
    const picked = await api.chooseDirectory();
    if (!picked) {
      setOpening(false);
      return;
    }
    const res = await createProject(basename(picked), picked);
    setOpening(false);
    if (!res.ok) setError(res.error ?? "Couldn't open that folder");
  };

  const actionCard =
    "group flex w-[200px] flex-col items-center gap-2.5 rounded-lg border border-white/10 bg-clide-panel/60 px-5 py-5 transition-colors hover:border-white/25 hover:bg-white/[0.04]";

  return (
    <div className="clide-scroll flex flex-1 flex-col items-center justify-center overflow-y-auto p-8">
      {/* Brand */}
      <div className="clide-rise flex flex-col items-center" style={{ animationDelay: "0ms" }}>
        <h1 className="text-[60px] font-bold text-white pt-5">CLIDE</h1>
      </div>
      <p className="clide-rise mt-1 text-[23px] italic text-white/30" style={{ animationDelay: "120ms" }}>
        Your Automation Workhorse
      </p>

      {/* Primary actions */}
      <div className="clide-rise mt-10 flex gap-3" style={{ animationDelay: "240ms" }}>
        <button onClick={openNewProject} className={actionCard}>
          <FolderPlus size={20} className="text-white/50 transition-colors group-hover:text-white" />
          <span className="text-[13px] font-medium text-white/80 group-hover:text-white">New project</span>
          <span className="text-[11px] text-white/30">Start something fresh</span>
        </button>
        <button onClick={() => void openExisting()} disabled={opening} className={`${actionCard} disabled:opacity-50`}>
          <FolderOpen size={20} className="text-white/50 transition-colors group-hover:text-white" />
          <span className="text-[13px] font-medium text-white/80 group-hover:text-white">
            {opening ? "Opening…" : "Open folder"}
          </span>
          <span className="text-[11px] text-white/30">Use an existing directory</span>
        </button>
      </div>
      {error && <span className="clide-rise mt-3 text-[12px] text-red-400">{error}</span>}

      {/* Recents */}
      {recents.length > 0 && (
        <div className="clide-rise mt-10 w-[416px]" style={{ animationDelay: "360ms" }}>
          <div className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-white/25">
            Recent projects
          </div>
          <div className="overflow-hidden rounded-lg border border-white/10">
            {recents.map((name) => (
              <button
                key={name}
                onClick={() => setActiveProject(name)}
                className="flex w-full items-center gap-2.5 border-b border-white/5 px-4 py-2.5 text-left last:border-b-0 hover:bg-white/[0.04]"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-white/70">{name}</span>
                <span className="text-[11px] text-white/20">open →</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
