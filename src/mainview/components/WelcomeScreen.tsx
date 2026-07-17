import { FolderOpen, FolderPlus } from "lucide-react";
import { useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../rpc";

const basename = (p: string) => p.split("/").filter(Boolean).pop() ?? p;

/** Above this many known projects, a search filter appears above the list (ticket 77). */
const SEARCH_THRESHOLD = 8;

/**
 * Branded landing surface shown when no project is active (first launch or
 * after deselecting). Offers the three ways in: create a project, open an
 * existing folder, or jump into any project CLIDE knows about. Entrance is a
 * staggered rise; the mark carries a slow ambient glow (both respect reduced
 * motion).
 */
export default function WelcomeScreen() {
  const { projects, recentProjects, setActiveProject, openNewProject, createProject } = useApp();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  // Every known project shows here — recency only decides ordering (ticket 77).
  const all = [
    ...recentProjects.filter((p) => projects.includes(p)),
    ...projects.filter((p) => !recentProjects.includes(p)),
  ];
  const showSearch = all.length > SEARCH_THRESHOLD;
  const filtered = query.trim()
    ? all.filter((name) => name.toLowerCase().includes(query.trim().toLowerCase()))
    : all;
  const safeHighlight = Math.min(highlight, Math.max(0, filtered.length - 1));

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

      {/* Projects — every project CLIDE knows about, recency-ordered (ticket 77) */}
      {all.length > 0 && (
        <div className="clide-rise mt-10 w-[416px]" style={{ animationDelay: "360ms" }}>
          <div className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-white/25">
            Projects
          </div>
          {showSearch && (
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlight((h) => Math.min(filtered.length - 1, h + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlight((h) => Math.max(0, h - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const name = filtered[safeHighlight];
                  if (name) setActiveProject(name);
                }
              }}
              placeholder="Search projects…"
              className="mb-2 w-full rounded-md border border-white/10 bg-clide-surface px-3 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30"
            />
          )}
          <div className="clide-scroll max-h-[280px] overflow-y-auto rounded-lg border border-white/10">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-center text-[12px] text-white/30">No projects match</div>
            ) : (
              filtered.map((name, i) => (
                <button
                  key={name}
                  onClick={() => setActiveProject(name)}
                  onMouseEnter={() => setHighlight(i)}
                  title={name}
                  className={`flex w-full items-center gap-2.5 border-b border-white/5 px-4 py-2.5 text-left last:border-b-0 hover:bg-white/[0.04] ${
                    showSearch && safeHighlight === i ? "bg-white/[0.06]" : ""
                  }`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-white/70">{name}</span>
                  <span className="text-[11px] text-white/20">open →</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
