/**
 * Files page (ticket 102): browse, search, and manage VFS locations.
 * App-scoped locations in Settings; project-scoped on project toolbar.
 */

import { useEffect, useState } from "react";
import type { VfsLocation, VfsStatResult } from "../../../shared/types";
import { api } from "../../rpc";

interface FilesPageProps {
  projectName?: string;
  scope: "app" | "project";
}

export function FilesPage({ projectName, scope }: FilesPageProps) {
  const [locations, setLocations] = useState<VfsLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<VfsLocation | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [entries, setEntries] = useState<VfsStatResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLocations();
  }, [projectName, scope]);

  async function loadLocations() {
    const locs = await api.listVfsLocations(projectName);
    const filtered =
      scope === "app"
        ? locs.filter((loc) => loc.scope === "app")
        : locs.filter((loc) => loc.scope === "project" && loc.project === projectName);
    setLocations(filtered);
  }

  async function handleAddLocation() {
    const folder = await api.chooseDirectory();
    if (!folder) return;

    const name = folder.split("/").pop() || "Unnamed Location";
    const location: VfsLocation = {
      id: crypto.randomUUID(),
      name,
      provider: "local",
      config: { root: folder },
      scope,
      project: scope === "project" ? projectName : undefined,
      watch: false,
    };

    const result = await api.addVfsLocation(location);
    if (result.ok) {
      await loadLocations();
    } else {
      alert(`Failed to add location: ${result.error}`);
    }
  }

  async function handleRemoveLocation(id: string) {
    if (!confirm("Remove this location? Past runs' artifact records will be preserved.")) return;

    const result = await api.removeVfsLocation(id, projectName);
    if (result.ok) {
      if (selectedLocation?.id === id) {
        setSelectedLocation(null);
        setEntries([]);
      }
      await loadLocations();
    } else {
      alert(`Failed to remove location: ${result.error}`);
    }
  }

  async function handleSelectLocation(location: VfsLocation) {
    setSelectedLocation(location);
    setCurrentPath("");
    setSearchQuery("");
    setSearchResults([]);
    await loadEntries(location, "");
  }

  async function loadEntries(location: VfsLocation, path: string) {
    setLoading(true);
    const result = await api.vfsList(location.id, path);
    setLoading(false);

    if (result.error) {
      alert(`Failed to list directory: ${result.error}`);
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
      return;
    }

    setLoading(true);
    const result = await api.vfsSearch(selectedLocation.id, query);
    setLoading(false);

    if (result.error) {
      alert(`Search failed: ${result.error}`);
      return;
    }

    setSearchResults(result.paths);
  }

  async function handleOpenFile(entry: VfsStatResult, reveal = false) {
    if (!selectedLocation) return;

    const path = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    const result = await api.vfsOpen(selectedLocation.id, path, reveal);

    if (!result.ok) {
      alert(`Failed to open file: ${result.error}`);
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Locations sidebar */}
      <div className="flex h-full">
        <div className="w-64 border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold mb-3">{scope === "app" ? "App Locations" : "Project Locations"}</h2>
            <button
              onClick={handleAddLocation}
              className="w-full px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
            >
              + Add Location
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {locations.length === 0 && (
              <div className="p-4 text-sm text-gray-500 text-center">
                No locations yet.
                <br />
                CLIDE only watches where you point it.
              </div>
            )}
            {locations.map((loc) => (
              <button
                key={loc.id}
                onClick={() => handleSelectLocation(loc)}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                  selectedLocation?.id === loc.id ? "bg-blue-50" : ""
                }`}
              >
                <div className="font-medium text-sm">{loc.name}</div>
                <div className="text-xs text-gray-500 mt-1 truncate">{loc.config.root as string}</div>
              </button>
            ))}
          </div>
        </div>

        {/* File browser */}
        <div className="flex-1 flex flex-col">
          {selectedLocation ? (
            <>
              {/* Toolbar */}
              <div className="p-4 border-b border-gray-200 flex items-center gap-3">
                {currentPath && (
                  <button
                    onClick={handleGoUp}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                  >
                    ↑ Up
                  </button>
                )}
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search files..."
                    className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={() => handleRemoveLocation(selectedLocation.id)}
                  className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
                >
                  Remove
                </button>
              </div>

              {/* Breadcrumb */}
              {currentPath && (
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
                  {selectedLocation.name} / {currentPath}
                </div>
              )}

              {/* File list or search results */}
              <div className="flex-1 overflow-y-auto">
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                )}

                {!loading && searchResults.length > 0 && (
                  <div className="divide-y divide-gray-100">
                    {searchResults.map((path, idx) => (
                      <div key={idx} className="px-4 py-3 hover:bg-gray-50">
                        <div className="text-sm">{path}</div>
                      </div>
                    ))}
                  </div>
                )}

                {!loading && searchQuery && searchResults.length === 0 && (
                  <div className="p-4 text-sm text-gray-500 text-center">No results found.</div>
                )}

                {!loading && !searchQuery && entries.length === 0 && (
                  <div className="p-4 text-sm text-gray-500 text-center">Empty directory.</div>
                )}

                {!loading && !searchQuery && entries.length > 0 && (
                  <div className="divide-y divide-gray-100">
                    {entries.map((entry, idx) => (
                      <div
                        key={idx}
                        className="px-4 py-3 hover:bg-gray-50 flex items-center gap-3 cursor-pointer"
                        onClick={() => (entry.isDirectory ? handleNavigate(entry) : undefined)}
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {entry.isDirectory && "📁 "}
                            {!entry.isDirectory && "📄 "}
                            {entry.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {!entry.isDirectory && formatSize(entry.size)} · {new Date(entry.mtime).toLocaleString()}
                          </div>
                        </div>
                        {!entry.isDirectory && (
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenFile(entry, false);
                              }}
                              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
                            >
                              Open
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenFile(entry, true);
                              }}
                              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
                            >
                              Reveal
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
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select a location to browse files
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
