import { AlertTriangle, Search, Sparkles, Terminal, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../rpc";
import ServiceModelPicker, { type ServiceModelValue } from "./ServiceModelPicker";
import ToolDropZone, { fileToBase64 } from "./ToolDropZone";
import type { ToolRegistryEntry } from "../types/forms";

const inputBase =
  "rounded-md border border-clide-border bg-clide-surface px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30";

interface Props {
  serviceModel: ServiceModelValue;
  onServiceModelChange: (v: ServiceModelValue) => void;
  onSelect: (tool: ToolRegistryEntry) => void;
}

interface PendingResolve {
  nameOrPath: string;
  execPath: string;
}

/**
 * Wizard step 1 (ticket 54): find the tool a new form will wrap. Chat-style
 * "what do you want to do" AI suggestions layer on top of a plain searchable
 * registered-tools list + manual PATH resolution — every path works fully
 * without AI configured.
 */
export default function ToolFinder({ serviceModel, onServiceModelChange, onSelect }: Props) {
  const [tools, setTools] = useState<ToolRegistryEntry[]>([]);
  const [search, setSearch] = useState("");

  const [chatQuery, setChatQuery] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatSuggestions, setChatSuggestions] = useState<string[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);

  const [manualInput, setManualInput] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingResolve | null>(null);
  const [inspectBusy, setInspectBusy] = useState(false);

  useEffect(() => {
    void api.listTools().then(setTools);
  }, []);

  const filtered = tools.filter((t) => search.trim() === "" || t.name.toLowerCase().includes(search.trim().toLowerCase()));

  const ask = async () => {
    if (!chatQuery.trim() || !serviceModel.serviceId) return;
    setChatBusy(true);
    setChatError(null);
    const res = await api.suggestTools(chatQuery.trim(), serviceModel.serviceId, serviceModel.model);
    setChatBusy(false);
    if (!res.ok) {
      setChatError(res.error ?? "Couldn't get suggestions.");
      return;
    }
    setChatSuggestions(res.suggestions ?? []);
    if ((res.suggestions ?? []).length === 0) setChatError("No installed tools matched that.");
  };

  const resolveManual = async (nameOrPath: string) => {
    const trimmed = nameOrPath.trim();
    if (!trimmed) return;
    setManualBusy(true);
    setManualError(null);
    const res = await api.resolveTool(trimmed);
    setManualBusy(false);
    if (!res.ok || !res.execPath) {
      setManualError(res.error ?? "Could not resolve that tool.");
      return;
    }
    // Already registered under this real path — skip straight to selection.
    const existing = tools.find((t) => t.execPath === res.execPath);
    if (existing) {
      onSelect(existing);
      return;
    }
    setPending({ nameOrPath: trimmed, execPath: res.execPath! });
  };

  const addWithoutInspecting = async () => {
    if (!pending) return;
    setManualBusy(true);
    const res = await api.registerTool(pending.nameOrPath, undefined, "discovered");
    setManualBusy(false);
    if (!res.ok || !res.entry) {
      setManualError(res.error ?? "Could not register that tool.");
      return;
    }
    setPending(null);
    onSelect(res.entry);
  };

  const inspectAndAdd = async () => {
    if (!pending || !serviceModel.serviceId) return;
    setInspectBusy(true);
    setManualError(null);
    const res = await api.inspectTool(pending.nameOrPath, undefined, "discovered", serviceModel.serviceId, serviceModel.model);
    setInspectBusy(false);
    if (!res.ok || !res.entry) {
      setManualError(res.error ?? "Inspection failed.");
      return;
    }
    setPending(null);
    onSelect(res.entry);
  };

  // Drag-and-drop (ticket 55) — one file at a time here; drop several on the Tools page instead.
  const handleDrop = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setManualBusy(true);
    setManualError(null);
    const base64 = await fileToBase64(file);
    const res = await api.registerDroppedTool(file.name, base64);
    setManualBusy(false);
    if (!res.ok || !res.entry) {
      setManualError(res.error ?? `Could not register ${file.name}`);
      return;
    }
    setTools((prev) => (prev.some((t) => t.id === res.entry!.id) ? prev : [...prev, res.entry!]));
    setPending({ nameOrPath: res.entry.execPath, execPath: res.entry.execPath });
  };

  return (
    <ToolDropZone onFiles={(files) => void handleDrop(files)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border border-clide-border bg-clide-surface p-3">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-white/70">
          <Sparkles size={13} className="text-amber-300/70" />
          Ask what you want to do
        </div>
        <ServiceModelPicker value={serviceModel} onChange={onServiceModelChange} />
        <div className="flex items-center gap-2">
          <input
            className={`${inputBase} min-w-0 flex-1`}
            placeholder='e.g. "resize an image" or "convert video to gif"'
            value={chatQuery}
            onChange={(e) => setChatQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void ask();
            }}
            disabled={!serviceModel.serviceId}
          />
          <button
            onClick={() => void ask()}
            disabled={chatBusy || !chatQuery.trim() || !serviceModel.serviceId}
            className="shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
          >
            {chatBusy ? "Thinking…" : "Ask"}
          </button>
        </div>
        {!serviceModel.serviceId && (
          <span className="text-[12px] text-white/30">
            No AI service configured — search or type a tool name below instead.
          </span>
        )}
        {chatError && <span className="text-[12px] text-red-400">{chatError}</span>}
        {chatSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chatSuggestions.map((name) => (
              <button
                key={name}
                onClick={() => {
                  setManualInput(name);
                  void resolveManual(name);
                }}
                className="rounded-full bg-white/10 px-2.5 py-1 text-[12px] text-white/80 hover:bg-white/20"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-white/70">
          <Search size={13} className="text-white/40" />
          Or search registered tools
        </div>
        <input
          className={inputBase}
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="clide-scroll flex max-h-48 flex-col gap-0.5 overflow-y-auto">
          {filtered.length === 0 && <div className="px-1 py-2 text-[12px] italic text-white/30">No tools found.</div>}
          {filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-white/70 hover:bg-white/5 hover:text-white"
            >
              <Wrench size={12} className="shrink-0 text-white/30" />
              <span className="truncate">{t.name}</span>
              <span className="truncate text-[11px] text-white/30">{t.spec?.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-clide-border pt-4">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-white/70">
          <Terminal size={13} className="text-white/40" />
          Or type an executable name / path — or drag one in
        </div>
        <div className="flex items-center gap-2">
          <input
            className={`${inputBase} min-w-0 flex-1`}
            placeholder="ffmpeg, /usr/local/bin/mytool…"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void resolveManual(manualInput);
            }}
          />
          <button
            onClick={() => void resolveManual(manualInput)}
            disabled={manualBusy || !manualInput.trim()}
            className="shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
          >
            {manualBusy ? "Resolving…" : "Resolve"}
          </button>
        </div>
        {manualError && <span className="text-[12px] text-red-400">{manualError}</span>}
      </div>

      {pending && (
        <div className="flex flex-col gap-2 rounded-lg border border-clide-border bg-clide-surface p-3">
          <div className="text-[13px] text-white/70">
            Found <span className="font-mono text-white">{pending.execPath}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void addWithoutInspecting()}
              disabled={manualBusy}
              className="rounded-md px-3 py-1.5 text-[13px] text-white/70 hover:bg-white/5 hover:text-white"
            >
              Use without inspecting
            </button>
            {serviceModel.serviceId && (
              <div className="flex items-center gap-2 rounded-md border border-amber-400/30 bg-amber-400/5 px-2.5 py-1.5">
                <AlertTriangle size={13} className="shrink-0 text-amber-300" />
                <span className="text-[12px] text-amber-200">
                  Inspecting runs <span className="font-mono">--help</span>
                </span>
                <button
                  onClick={() => void inspectAndAdd()}
                  disabled={inspectBusy}
                  className="shrink-0 rounded-md bg-amber-400/80 px-2.5 py-1 text-[12px] font-medium text-black hover:bg-amber-400 disabled:opacity-40"
                >
                  {inspectBusy ? "Running…" : "Inspect with AI"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </ToolDropZone>
  );
}
