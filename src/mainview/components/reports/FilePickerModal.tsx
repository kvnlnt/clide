import { ChevronUp, File, Folder, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../rpc";
import type { VfsLocation, VfsStatResult } from "../../types/tasks";
import Modal from "../Modal";

interface FilePickerModalProps {
  onClose: () => void;
  onPick: (file: { uri: string; name: string }) => void;
}

/**
 * Lightweight single-file VFS browser (ticket 134) for picking a report's
 * file members — reuses the same locations/list/resolve RPCs as the Files
 * surface, trimmed down to "browse and pick one."
 */
export default function FilePickerModal({ onClose, onPick }: FilePickerModalProps) {
  const { activeProject } = useApp();
  const [locations, setLocations] = useState<VfsLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<VfsLocation | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<VfsStatResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.listVfsLocations(activeProject ?? undefined).then(setLocations);
  }, [activeProject]);

  async function selectLocation(location: VfsLocation) {
    setSelectedLocation(location);
    setCurrentPath("");
    setError(null);
    await loadEntries(location, "");
  }

  async function loadEntries(location: VfsLocation, path: string) {
    setLoading(true);
    setError(null);
    const result = await api.vfsList(location.id, path, activeProject ?? undefined);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      setEntries([]);
      return;
    }
    setEntries(result.entries);
  }

  async function navigate(entry: VfsStatResult) {
    if (!selectedLocation || !entry.isDirectory) return;
    const next = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    setCurrentPath(next);
    await loadEntries(selectedLocation, next);
  }

  async function goUp() {
    if (!selectedLocation || !currentPath) return;
    const parts = currentPath.split("/");
    parts.pop();
    const next = parts.join("/");
    setCurrentPath(next);
    await loadEntries(selectedLocation, next);
  }

  async function pick(entry: VfsStatResult) {
    if (!selectedLocation || entry.isDirectory) return;
    const path = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    const uri = await api.vfsResolveUri(selectedLocation.id, path, activeProject ?? undefined);
    if (!uri) {
      setError("Couldn't resolve this file's location.");
      return;
    }
    onPick({ uri, name: entry.name });
  }

  return (
    <Modal onClose={onClose} widthClassName="w-[640px]" panelClassName="flex max-h-[75vh] flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-clide-border px-4 py-3">
        <span className="text-[14px] font-bold text-white">Add a file</span>
        <button onClick={onClose} className="text-white/40 hover:text-white">
          <X size={16} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="clide-scroll w-48 shrink-0 overflow-y-auto border-r border-clide-border">
          {locations.length === 0 && (
            <div className="px-3 py-4 text-center text-[12px] text-white/30">No locations registered yet.</div>
          )}
          {locations.map((loc) => (
            <button
              key={loc.id}
              onClick={() => void selectLocation(loc)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] ${
                selectedLocation?.id === loc.id ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5"
              }`}
            >
              <Folder size={12} className="shrink-0" />
              <span className="truncate">{loc.name}</span>
            </button>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {selectedLocation ? (
            <>
              {currentPath && (
                <div className="flex shrink-0 items-center gap-2 border-b border-clide-border px-3 py-2">
                  <button
                    onClick={() => void goUp()}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[12px] text-white/60 hover:bg-white/5 hover:text-white"
                  >
                    <ChevronUp size={12} /> Up
                  </button>
                  <span className="truncate text-[11px] text-white/40">{currentPath}</span>
                </div>
              )}
              <div className="clide-scroll flex-1 overflow-y-auto">
                {loading && <div className="py-8 text-center text-[13px] text-white/30">Loading…</div>}
                {error && <div className="px-3 py-3 text-[12px] text-red-300">{error}</div>}
                {!loading && !error && entries.length === 0 && (
                  <div className="py-8 text-center text-[13px] italic text-white/30">Empty directory.</div>
                )}
                {!loading &&
                  entries.map((entry, idx) => (
                    <button
                      key={idx}
                      onClick={() => (entry.isDirectory ? void navigate(entry) : void pick(entry))}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-white/5"
                    >
                      {entry.isDirectory ? (
                        <Folder size={13} className="shrink-0 text-white/40" />
                      ) : (
                        <File size={13} className="shrink-0 text-white/30" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-white/80">{entry.name}</span>
                    </button>
                  ))}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[13px] italic text-white/30">
              Select a location to browse
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
