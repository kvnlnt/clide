/**
 * Files page (ticket 102, restyled/fixed ticket 118): browse, search, and
 * manage VFS locations. App-scoped locations in Settings; project-scoped on
 * the project toolbar.
 */

import { ChevronUp, File, Folder, FolderOpen, FolderPlus, Search, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { useDirectoryPicker } from "../../hooks/useDirectoryPicker";
import { api } from "../../rpc";
import type { VfsLocation, VfsStatResult } from "../../types/tasks";
import { useUIFeedback } from "../UIFeedback";

interface FilesPageProps {
  projectName?: string;
  scope: "app" | "project";
}

/**
 * A location plus the project it belongs to, when browsing cross-project
 * (ticket 132) — `projectName` is undefined for app-scoped locations, and
 * for the project-scoped instance (which only ever shows its own project).
 */
interface LocationEntry {
  location: VfsLocation;
  projectName?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesPage({ projectName, scope }: FilesPageProps) {
  const { projectMeta } = useApp();
  const { confirm, toast } = useUIFeedback();
  const chooseDirectory = useDirectoryPicker();
  const [locations, setLocations] = useState<LocationEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<LocationEntry | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [entries, setEntries] = useState<VfsStatResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ticket 132: app-scoped view can additionally show every project's
  // locations, grouped by project so the two stay visually distinct.
  const [includeProjectFiles, setIncludeProjectFiles] = useState(false);

  const selectedLocation = selectedEntry?.location ?? null;

  // Ticket 118: project-scoped locations live under the project's real
  // folder path, not its display name — the registry keys .vfs.json by path.
  const projectPath = projectName ? projectMeta.find((p) => p.name === projectName)?.path : undefined;

  useEffect(() => {
    void loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName, scope, includeProjectFiles]);

  async function loadLocations() {
    const locs = await api.listVfsLocations(projectName);
    if (scope === "app") {
      const appEntries: LocationEntry[] = locs
        .filter((loc) => loc.scope === "app")
        .map((location) => ({ location }));

      if (!includeProjectFiles) {
        setLocations(appEntries);
        return;
      }

      const projectLocs = await api.listAllProjectVfsLocations();
      setLocations([...appEntries, ...projectLocs.map(({ location, projectName: pName }) => ({ location, projectName: pName }))]);
      return;
    }

    const filtered = locs
      .filter((loc) => loc.scope === "project" && loc.project === projectPath)
      .map((location) => ({ location, projectName }));
    setLocations(filtered);
  }

  async function handleAddLocation() {
    if (scope === "project" && !projectPath) return;
    const folder = await chooseDirectory();
    if (!folder) return;

    const name = folder.split("/").pop() || "Unnamed Location";
    const location: VfsLocation = {
      id: crypto.randomUUID(),
      name,
      provider: "local",
      config: { root: folder },
      scope,
      project: scope === "project" ? projectPath : undefined,
      watch: false,
    };

    const result = await api.addVfsLocation(location);
    if (result.ok) {
      toast(`Added "${name}"`);
      await loadLocations();
    } else {
      toast(result.error ?? "Failed to add location", "error");
    }
  }

  async function handleRemoveLocation(entry: LocationEntry) {
    const { location } = entry;
    const res = await confirm({
      title: `Remove "${location.name}"?`,
      message: "Past runs' artifact records are preserved — only the location itself is removed.",
      confirmLabel: "Remove",
    });
    if (!res.ok) return;

    const result = await api.removeVfsLocation(location.id, entry.projectName);
    if (result.ok) {
      if (selectedLocation?.id === location.id) {
        setSelectedEntry(null);
        setEntries([]);
      }
      toast("Location removed");
      await loadLocations();
    } else {
      toast(result.error ?? "Failed to remove location", "error");
    }
  }

  async function handleSelectLocation(entry: LocationEntry) {
    setSelectedEntry(entry);
    setCurrentPath("");
    setSearchQuery("");
    setSearchResults([]);
    setError(null);
    await loadEntries(entry, "");
  }

  async function loadEntries(entry: LocationEntry, path: string) {
    setLoading(true);
    setError(null);
    const result = await api.vfsList(entry.location.id, path, entry.projectName);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      setEntries([]);
      return;
    }

    setEntries(result.entries);
  }

  async function handleNavigate(entry: VfsStatResult) {
    if (!selectedEntry) return;
    if (!entry.isDirectory) return;

    const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    setCurrentPath(newPath);
    await loadEntries(selectedEntry, newPath);
  }

  async function handleGoUp() {
    if (!selectedEntry || !currentPath) return;

    const parts = currentPath.split("/");
    parts.pop();
    const newPath = parts.join("/");
    setCurrentPath(newPath);
    await loadEntries(selectedEntry, newPath);
  }

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (!selectedEntry || !query.trim()) {
      setSearchResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const result = await api.vfsSearch(selectedEntry.location.id, query, selectedEntry.projectName);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      setSearchResults([]);
      return;
    }

    setSearchResults(result.paths);
  }

  async function handleOpenFile(entry: VfsStatResult, reveal = false) {
    if (!selectedEntry) return;

    const path = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    const result = await api.vfsOpen(selectedEntry.location.id, path, reveal, selectedEntry.projectName);

    if (!result.ok) {
      toast(result.error ?? "Failed to open file", "error");
    }
  }

  const rowClass = "flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-white/5";

  const appEntries = locations.filter((e) => !e.projectName);
  const projectGroups: [string, LocationEntry[]][] = [];
  for (const e of locations) {
    if (!e.projectName) continue;
    const group = projectGroups.find(([name]) => name === e.projectName);
    if (group) group[1].push(e);
    else projectGroups.push([e.projectName, [e]]);
  }

  function renderLocationRow(entry: LocationEntry) {
    const { location } = entry;
    return (
      <button
        key={location.id}
        onClick={() => void handleSelectLocation(entry)}
        className={`group flex w-full items-center gap-2 border-b border-white/5 px-4 py-3 text-left ${
          selectedLocation?.id === location.id ? "bg-white/10" : "hover:bg-white/5"
        }`}
      >
        <Folder size={14} className="shrink-0 text-white/40" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-white">{location.name}</div>
          <div className="truncate text-[11px] text-white/40">{location.config.root as string}</div>
        </div>
        <span
          onClick={(e) => {
            e.stopPropagation();
            void handleRemoveLocation(entry);
          }}
          title="Remove location"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/0 group-hover:text-white/40 hover:!text-red-400"
        >
          <Trash2 size={12} />
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-baseline justify-between gap-2 px-[var(--clide-page-x)] pb-4 pt-[var(--clide-page-top)]">
        <div className="flex items-baseline gap-2">
          <h1 className="text-[20px] font-bold text-white">Files</h1>
          <span className="text-[13px] text-white/40">
            {scope === "app" ? "App locations" : (projectName ?? "Project locations")}
          </span>
        </div>
        {scope === "app" && (
          <label className="flex items-center gap-2 text-[12px] text-white/60">
            <input
              type="checkbox"
              checked={includeProjectFiles}
              onChange={(e) => setIncludeProjectFiles(e.target.checked)}
              className="h-3.5 w-3.5 accent-white/70"
            />
            Include project files
          </label>
        )}
      </div>

      <div className="clide-scroll flex flex-1 overflow-hidden px-[var(--clide-page-x)] pb-[var(--clide-page-bottom)]">
        <div className="flex w-full overflow-hidden rounded-md border border-clide-border">
          {/* Locations sidebar */}
          <div className="flex w-64 shrink-0 flex-col border-r border-clide-border bg-clide-panel">
            <div className="border-b border-clide-border p-3">
              <button
                disabled={scope === "project" && !projectPath}
                onClick={() => void handleAddLocation()}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-white/10 px-3 py-2 text-[12px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
              >
                <FolderPlus size={13} /> Add Location
              </button>
            </div>

            <div className="clide-scroll flex-1 overflow-y-auto">
              {locations.length === 0 && (
                <div className="px-4 py-6 text-center text-[12px] text-white/30">
                  No locations yet.
                  <br />
                  CLIDE only watches where you point it.
                </div>
              )}

              {includeProjectFiles && projectGroups.length > 0 && appEntries.length > 0 && (
                <div className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-white/30">App</div>
              )}
              {appEntries.map(renderLocationRow)}

              {projectGroups.map(([pName, entries]) => (
                <div key={pName}>
                  <div className="flex items-center gap-1.5 border-t border-white/5 bg-white/[0.03] px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                    <Folder size={10} /> {pName}
                  </div>
                  {entries.map(renderLocationRow)}
                </div>
              ))}
            </div>
          </div>

          {/* File browser */}
          <div className="flex flex-1 flex-col bg-clide-bg">
            {selectedLocation ? (
              <>
                {/* Toolbar */}
                <div className="flex shrink-0 items-center gap-2 border-b border-clide-border px-4 py-3">
                  {currentPath && (
                    <button
                      onClick={() => void handleGoUp()}
                      className="flex items-center gap-1 rounded-md border border-clide-border px-2.5 py-1.5 text-[12px] text-white/70 hover:bg-white/5 hover:text-white"
                    >
                      <ChevronUp size={13} /> Up
                    </button>
                  )}
                  <div className="flex flex-1 items-center gap-2 rounded-md border border-clide-border bg-clide-surface px-2.5 py-1.5">
                    <Search size={13} className="shrink-0 text-white/30" />
                    <input
                      value={searchQuery}
                      onChange={(e) => void handleSearch(e.target.value)}
                      placeholder="Search files…"
                      className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/40"
                    />
                    {searchQuery && (
                      <button onClick={() => void handleSearch("")} className="shrink-0 text-white/30 hover:text-white">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Breadcrumb */}
                {currentPath && !searchQuery && (
                  <div className="shrink-0 border-b border-clide-border bg-clide-panel/60 px-4 py-2 text-[12px] text-white/50">
                    {selectedEntry?.projectName && <span className="text-white/30">{selectedEntry.projectName} / </span>}
                    {selectedLocation.name} / {currentPath}
                  </div>
                )}

                {/* File list or search results */}
                <div className="clide-scroll flex-1 overflow-y-auto">
                  {error && (
                    <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-[12px] text-red-300">
                      <span>{error}</span>
                      <button
                        onClick={() =>
                          searchQuery ? void handleSearch(searchQuery) : void (selectedEntry && loadEntries(selectedEntry, currentPath))
                        }
                        className="shrink-0 rounded px-2 py-0.5 font-medium text-red-200 hover:bg-red-400/20"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {loading && <div className="py-12 text-center text-[13px] text-white/30">Loading…</div>}

                  {!loading && searchQuery && searchResults.length > 0 && (
                    <div className="flex flex-col divide-y divide-white/5">
                      {searchResults.map((path, idx) => (
                        <div key={idx} className={rowClass}>
                          <File size={14} className="shrink-0 text-white/30" />
                          <span className="min-w-0 truncate text-white/80">{path}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {!loading && !error && searchQuery && searchResults.length === 0 && (
                    <div className="py-12 text-center text-[13px] italic text-white/30">No results found.</div>
                  )}

                  {!loading && !error && !searchQuery && entries.length === 0 && (
                    <div className="py-12 text-center text-[13px] italic text-white/30">Empty directory.</div>
                  )}

                  {!loading && !searchQuery && entries.length > 0 && (
                    <div className="flex flex-col divide-y divide-white/5">
                      {entries.map((entry, idx) => (
                        <div
                          key={idx}
                          className={`${rowClass} ${entry.isDirectory ? "cursor-pointer" : ""}`}
                          onClick={() => (entry.isDirectory ? void handleNavigate(entry) : undefined)}
                        >
                          {entry.isDirectory ? (
                            <Folder size={14} className="shrink-0 text-white/40" />
                          ) : (
                            <File size={14} className="shrink-0 text-white/30" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-white">{entry.name}</div>
                            <div className="text-[11px] text-white/40">
                              {!entry.isDirectory && `${formatSize(entry.size)} · `}
                              {new Date(entry.mtime).toLocaleString()}
                            </div>
                          </div>
                          {!entry.isDirectory && (
                            <div className="flex shrink-0 gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleOpenFile(entry, false);
                                }}
                                title="Open"
                                className="flex h-7 w-7 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"
                              >
                                <File size={13} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleOpenFile(entry, true);
                                }}
                                title="Reveal in Finder"
                                className="flex h-7 w-7 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"
                              >
                                <FolderOpen size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-[13px] italic text-white/30">
                Select a location to browse files
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
