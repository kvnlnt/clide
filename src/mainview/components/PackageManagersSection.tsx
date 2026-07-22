import { GripVertical, Plus, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../rpc";

export default function PackageManagersSection() {
  const [list, setList] = useState<any[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", path: "" });
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const refresh = async () => {
    setList(await api.listPackageManagers());
  };

  useEffect(() => {
    void refresh();
  }, []);

  const detect = async () => {
    const detected = await api.detectPackageManagers();
    setList(detected);
  };

  const add = async () => {
    if (!form.id || !form.path) return;
    const res = await api.addCustomPackageManager(form.id, form.name || form.id, form.path, true);
    if (res.ok) {
      setAdding(false);
      setForm({ id: "", name: "", path: "" });
      await refresh();
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    if (!list) return;
    const next = [...list];
    const to = index + dir;
    if (to < 0 || to >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    setList(next);
    await api.savePackageManagers(next);
  };

  const reorder = async (from: number, to: number) => {
    if (!list || from === to) return;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setList(next);
    await api.savePackageManagers(next);
  };

  const toggleEnabled = async (index: number) => {
    if (!list) return;
    const next = [...list];
    next[index] = { ...next[index], enabled: !next[index].enabled };
    setList(next);
    await api.savePackageManagers(next);
  };

  const firstEnabledIndex = list?.findIndex((m) => m.enabled) ?? -1;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-wider text-white/40">Package Managers</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void detect()}
            className="rounded-md px-2 py-1 text-[12px] text-white/60 hover:bg-white/5"
          >
            <RefreshCw size={13} /> Re-detect
          </button>
          <button
            onClick={() => setAdding((s) => !s)}
            className="rounded-md px-2 py-1 text-[12px] text-white/60 hover:bg-white/5"
          >
            <Plus size={13} /> Add manager
          </button>
        </div>
      </div>

      <div className="mt-2 text-[12px] text-white/30">
        Detects Homebrew, npm/bun, pipx, and cargo. Register a custom manager with an absolute binary path. Disabled
        managers are skipped during search and install. Drag rows to set the preferred order — top of the list wins.
      </div>

      {adding && (
        <div className="mt-3 flex gap-2">
          <input
            className="w-32 rounded-md bg-clide-bg px-2 py-1"
            placeholder="id"
            value={form.id}
            onChange={(e) => setForm({ ...form, id: e.target.value })}
          />
          <input
            className="w-48 rounded-md bg-clide-bg px-2 py-1"
            placeholder="display name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="flex-1 rounded-md bg-clide-bg px-2 py-1"
            placeholder="absolute path to binary"
            value={form.path}
            onChange={(e) => setForm({ ...form, path: e.target.value })}
          />
          <button
            onClick={() => void add()}
            className="rounded-md px-3 py-1 text-[12px] text-white/60 hover:bg-white/5"
          >
            Add
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {list === null && <div className="text-[13px] italic text-white/30">Loading…</div>}
        {list?.map((m, idx) => (
          <div
            key={m.id}
            draggable
            onDragStart={() => {
              dragIndex.current = idx;
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverIndex(idx);
            }}
            onDragLeave={() => setDragOverIndex((cur) => (cur === idx ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragIndex.current;
              dragIndex.current = null;
              setDragOverIndex(null);
              if (from !== null) void reorder(from, idx);
            }}
            onDragEnd={() => {
              dragIndex.current = null;
              setDragOverIndex(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                void move(idx, -1);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                void move(idx, 1);
              }
            }}
            tabIndex={0}
            className={`flex items-center justify-between rounded-md border p-2 outline-none focus:border-white/30 ${
              dragOverIndex === idx ? "border-white/40 bg-white/5" : "border-clide-border"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="cursor-grab text-white/30 hover:text-white/60" aria-hidden="true">
                <GripVertical size={14} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-white">
                  {m.name}
                  {idx === firstEnabledIndex && (
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/50">
                      Preferred
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-white/40">
                  {m.path ?? "(not detected)"} {m.version ? ` · ${m.version}` : null}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[12px] text-white/40">
                <input
                  type="checkbox"
                  checked={!!m.enabled}
                  onChange={() => void toggleEnabled(idx)}
                  className="accent-white/70"
                />
                {m.enabled ? "Enabled" : "Disabled"}
              </label>
              <div className="flex flex-col opacity-30 hover:opacity-80 transition-opacity">
                <button
                  onClick={() => void move(idx, -1)}
                  aria-label="Move up"
                  className="text-[11px] text-white/40 hover:text-white/70"
                >
                  ▲
                </button>
                <button
                  onClick={() => void move(idx, 1)}
                  aria-label="Move down"
                  className="text-[11px] text-white/40 hover:text-white/70"
                >
                  ▼
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
