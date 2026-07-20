/**
 * Files page (ticket 102, restyled/fixed ticket 118): browse, search, and
 * manage VFS locations. App-scoped locations in Settings; project-scoped on
 * the project toolbar.
 */

import { ChevronUp, File, Folder, FolderOpen, FolderPlus, Search, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../rpc";
import type { VfsLocation, VfsStatResult } from "../../types/tasks";
import { useUIFeedback } from "../UIFeedback";

interface FilesPageProps {
  projectName?: string;
  scope: "app" | "project";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesPage({ projectName, scope }: FilesPageProps) {
  const { projectMeta } = useApp();
  const { confirm, toast } = useUIFeedback();
  const [locations, setLocations] = useState<VfsLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<VfsLocation | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [entries, setEntries] = useState<VfsStatResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ticket 118: project-scoped locations live under the project's real
  // folder path, not its display name — the registry keys .vfs.json by path.
  const projectPath = projectName ? projectMeta.find((p) => p.name === projectName)?.path : undefined;

  useEffect(() => {
    void loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName, scope]);

  async function loadLocations() {
    const locs = await api.listVfsLocations(projectName);
    const filtered =
      scope === "app"
        ? locs.filter((loc) => loc.scope === "app")
        : locs.filter((loc) => loc.scope === "project" && loc.project === projectPath);
    setLocations(filtered);
  }

  async function handleAddLocation() {
    if (scope === "project" && !projectPath) return;
    const folder = await api.chooseDirectory();
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

  async function handleRemoveLocation(location: VfsLocation) {
    const res = await confirm({
      title: `Remove "${location.name}"?`,
      message: "Past runs' artifact records are preserved — only the location itself is removed.",
      confirmLabel: "Remove",
    });
    if (!res.ok) return;

    const result = await api.removeVfsLocation(location.id, projectName);
    if (result.ok) {
      if (selectedLocation?.id === location.id) {
        setSelectedLocation(null);
        setEntries([]);
      }
      toast("Location removed");
      await loadLocations();
    } else {
      toast(result.error ?? "Failed to remove location", "error");
    }
  }

  async function handleSelectLocation(location: VfsLocation) {
    setSelectedLocation(location);
    setCurrentPath("");
    setSearchQuery("");
    setSearchResults([]);
    setError(null);
    await loadEntries(location, "");
  }

  async function loadEntries(location: VfsLocation, path: string) {
    setLoading(true);
    setError(null);
    const result = await api.vfsList(location.id, path, projectName);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      setEntries([]);
      return;
    }

    setEntries(result.entries);
  }

  async function handleNavigate(entry: VfsStatResult) {
    if (!selectedLocation) return;
    if (!entry.isDirectory) return;

    const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    setCurrentPath(newPath);
    await loadEntries(selectedLocation, newPath);
  }

  async function handleGoUp() {
    if (!selectedLocation || !currentPath) return;

    const parts = currentPath.split("/");
    parts.pop();
    const newPath = parts.join("/");
    setCurrentPath(newPath);
    await loadEntries(selectedLocation, newPath);
  }

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (!selectedLocation || !query.trim()) {
      setSearchResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const result = await api.vfsSearch(selectedLocation.id, query, projectName);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      setSearchResults([]);
      return;
    }

    setSearchResults(result.paths);
  }

  async function handleOpenFile(entry: VfsStatResult, reveal = false) {
    if (!selectedLocation) return;

    const path = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    const result = await api.vfsOpen(selectedLocation.id, path, reveal, projectName);

    if (!result.ok) {
      toast(result.error ?? "Failed to open file", "error");
    }
  }

  const rowClass = "flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-white/5";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-baseline gap-2 px-8 pb-4 pt-7">
        <h1 className="text-[20px] font-bold text-white">Files</h1>
        <span className="text-[13px] text-white/40">
          {scope === "app" ? "App locations" : (projectName ?? "Project locations")}
        </span>
      </div>

      <div className="clide-scroll flex flex-1 overflow-hidden px-8 pb-8">
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
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => void handleSelectLocation(loc)}
                  className={`group flex w-full items-center gap-2 border-b border-white/5 px-4 py-3 text-left ${
                    selectedLocation?.id === loc.id ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <Folder size={14} className="shrink-0 text-white/40" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-white">{loc.name}</div>
                    <div className="truncate text-[11px] text-white/40">{loc.config.root as string}</div>
                  </div>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleRemoveLocation(loc);
                    }}
                    title="Remove location"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/0 group-hover:text-white/40 hover:!text-red-400"
                  >
                    <Trash2 size={12} />
                  </span>
                </button>
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
                          searchQuery ? void handleSearch(searchQuery) : void loadEntries(selectedLocation, currentPath)
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
