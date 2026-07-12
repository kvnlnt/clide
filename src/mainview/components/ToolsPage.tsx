import { AlertTriangle, ChevronDown, ChevronRight, Terminal, Trash2, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../rpc";
import ServiceModelPicker, { type ServiceModelValue } from "./ServiceModelPicker";
import ToolDropZone, { fileToBase64 } from "./ToolDropZone";
import type { ToolRegistryEntry } from "../types/forms";

const inputBase =
  "rounded-md border border-clide-border bg-clide-surface px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30";

interface PendingRun {
  mode: "add" | "reinspect";
  nameOrPath: string;
  displayName?: string;
  execPath: string;
  serviceModel: ServiceModelValue;
}

/**
 * Manages the tool registry (ticket 53): resolve/inspect installed CLI tools,
 * view their raw --help/man capture and AI-distilled spec, re-inspect with a
 * chosen service+model, or paste docs by hand. Feeds the wizard's tool finder
 * (ticket 54) and the drag-and-drop registration flow (ticket 55).
 */
export default function ToolsPage() {
  const [tools, setTools] = useState<ToolRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [addInput, setAddInput] = useState("");
  const [addName, setAddName] = useState("");
  const [addServiceModel, setAddServiceModel] = useState<ServiceModelValue>({ serviceId: "", model: "" });
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [pending, setPending] = useState<PendingRun | null>(null);
  const [pendingBusy, setPendingBusy] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const [pasteFor, setPasteFor] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [pasteServiceModel, setPasteServiceModel] = useState<ServiceModelValue>({ serviceId: "", model: "" });
  const [pasteBusy, setPasteBusy] = useState(false);

  // Drag-and-drop registration queue (ticket 55) — one consent gate at a time.
  const [dropQueue, setDropQueue] = useState<File[]>([]);
  const [dropBusy, setDropBusy] = useState(false);

  const refresh = () => {
    void api.listTools().then((list) => {
      setTools(list);
      setLoading(false);
    });
  };

  useEffect(refresh, []);

  useEffect(() => {
    if (dropBusy || pending || dropQueue.length === 0) return;
    const [next, ...rest] = dropQueue;
    setDropQueue(rest);
    setDropBusy(true);
    void (async () => {
      const base64 = await fileToBase64(next!);
      const res = await api.registerDroppedTool(next!.name, base64);
      setDropBusy(false);
      if (!res.ok || !res.entry) {
        setAddError(res.error ?? `Could not register ${next!.name}`);
        return;
      }
      refresh();
      setPending({
        mode: "add",
        nameOrPath: res.entry.execPath,
        displayName: res.entry.name,
        execPath: res.entry.execPath,
        serviceModel: addServiceModel,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropQueue, dropBusy, pending]);

  const startAdd = async () => {
    const nameOrPath = addInput.trim();
    if (!nameOrPath) return;
    setAddBusy(true);
    setAddError(null);
    const resolved = await api.resolveTool(nameOrPath);
    setAddBusy(false);
    if (!resolved.ok || !resolved.execPath) {
      setAddError(resolved.error ?? "Could not resolve that tool.");
      return;
    }
    setPending({
      mode: "add",
      nameOrPath,
      displayName: addName.trim() || undefined,
      execPath: resolved.execPath,
      serviceModel: addServiceModel,
    });
  };

  const startReinspect = (tool: ToolRegistryEntry) => {
    setPending({
      mode: "reinspect",
      nameOrPath: tool.execPath,
      displayName: tool.name,
      execPath: tool.execPath,
      serviceModel: tool.inspectedWith
        ? { serviceId: tool.inspectedWith.serviceId, model: tool.inspectedWith.model }
        : { serviceId: "", model: "" },
    });
  };

  const confirmPending = async () => {
    if (!pending) return;
    if (!pending.serviceModel.serviceId) {
      setPendingError("Pick an AI service first.");
      return;
    }
    setPendingBusy(true);
    setPendingError(null);
    const res = await api.inspectTool(
      pending.nameOrPath,
      pending.displayName,
      "discovered",
      pending.serviceModel.serviceId,
      pending.serviceModel.model,
    );
    setPendingBusy(false);
    if (!res.ok) {
      setPendingError(res.error ?? "Inspection failed.");
      return;
    }
    setPending(null);
    if (pending.mode === "add") {
      setAddInput("");
      setAddName("");
    }
    if (res.error) setAddError(res.error); // distillation-only failure — entry still saved with raw help text
    refresh();
  };

  const remove = async (id: string) => {
    await api.removeTool(id);
    refresh();
  };

  const submitPaste = async (toolId: string) => {
    if (!pasteText.trim() || !pasteServiceModel.serviceId) return;
    setPasteBusy(true);
    await api.redistillTool(toolId, pasteText, pasteServiceModel.serviceId, pasteServiceModel.model);
    setPasteBusy(false);
    setPasteFor(null);
    setPasteText("");
    refresh();
  };

  return (
    <ToolDropZone
      onFiles={(files) => setDropQueue((q) => [...q, ...files])}
      className="flex flex-1 flex-col overflow-hidden"
    >
      <div className="flex shrink-0 items-baseline gap-2 px-8 pb-4 pt-7">
        <h1 className="text-[20px] font-bold text-white">Tools</h1>
        <span className="text-[13px] text-white/40">
          CLI tools registered for use in forms — drag an executable in to register it
        </span>
      </div>

      <div className="clide-scroll flex-1 overflow-y-auto px-8 pb-8">
        {/* Add tool */}
        <div className="mb-5 flex flex-col gap-2 rounded-lg border border-clide-border bg-clide-surface p-3">
          <div className="flex items-center gap-2">
            <input
              className={`${inputBase} min-w-0 flex-1`}
              placeholder="Executable name (e.g. ffmpeg) or absolute path"
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void startAdd();
              }}
            />
            <input
              className={`${inputBase} w-40 shrink-0`}
              placeholder="Display name"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
            />
          </div>
          <ServiceModelPicker value={addServiceModel} onChange={setAddServiceModel} />
          <div className="flex items-center justify-between">
            {addError ? (
              <span className="text-[12px] text-red-400">{addError}</span>
            ) : (
              <span className="text-[12px] text-white/30">
                Resolves the tool on PATH, then asks to confirm before running --help.
              </span>
            )}
            <button
              onClick={() => void startAdd()}
              disabled={addBusy || !addInput.trim()}
              className="rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
            >
              {addBusy ? "Resolving…" : "Resolve & inspect"}
            </button>
          </div>
        </div>

        {/* Consent-gated inspection confirm (ticket 53) */}
        {pending && (
          <div className="mb-5 flex flex-col gap-2 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-amber-300">
              <AlertTriangle size={14} />
              This will execute the tool to read its help
            </div>
            <div className="flex items-center gap-1.5 rounded border border-clide-border bg-clide-bg px-2.5 py-1.5 font-mono text-[12px] text-white/70">
              <Terminal size={12} className="shrink-0 text-white/30" />
              {pending.execPath} --help
            </div>
            <ServiceModelPicker
              value={pending.serviceModel}
              onChange={(v) => setPending((p) => (p ? { ...p, serviceModel: v } : p))}
            />
            {pendingError && <span className="text-[12px] text-red-400">{pendingError}</span>}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setPending(null)}
                className="rounded-md px-3 py-1.5 text-[13px] text-white/50 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmPending()}
                disabled={pendingBusy}
                className="rounded-md bg-amber-400/80 px-3 py-1.5 text-[13px] font-medium text-black hover:bg-amber-400 disabled:opacity-40"
              >
                {pendingBusy ? "Running…" : "Run & inspect"}
              </button>
            </div>
          </div>
        )}

        {/* Registered tools */}
        {loading ? (
          <div className="py-8 text-center text-[13px] text-white/30">Loading…</div>
        ) : tools.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
              <Wrench size={20} className="text-white/40" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[14px] font-medium text-white/70">No tools registered yet</span>
              <span className="text-[13px] text-white/40">
                Add one above, or drag an executable onto this page.
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-white/5 border-t border-white/5">
            {tools.map((tool) => {
              const expanded = expandedId === tool.id;
              return (
                <div key={tool.id} className="py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedId(expanded ? null : tool.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      {expanded ? (
                        <ChevronDown size={14} className="shrink-0 text-white/30" />
                      ) : (
                        <ChevronRight size={14} className="shrink-0 text-white/30" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[14px] text-white">{tool.name}</span>
                          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-white/40">
                            {tool.source}
                          </span>
                        </div>
                        <span className="truncate text-[12px] text-white/40">
                          {tool.spec?.description || tool.execPath}
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={() => startReinspect(tool)}
                      className="shrink-0 rounded-md px-2.5 py-1 text-[12px] text-white/60 hover:bg-white/5 hover:text-white"
                    >
                      Re-inspect
                    </button>
                    <button
                      onClick={() => void remove(tool.id)}
                      title="Remove"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-red-400/70 hover:bg-white/10 hover:text-red-400"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {expanded && (
                    <div className="ml-6 mt-2 flex flex-col gap-3">
                      <div className="text-[12px] text-white/40">{tool.execPath}</div>

                      {tool.spec ? (
                        <div className="flex flex-col gap-2 text-[13px] text-white/70">
                          {tool.spec.subcommands.length > 0 && (
                            <div>
                              <div className="mb-1 text-[11px] font-medium uppercase text-white/30">Subcommands</div>
                              {tool.spec.subcommands.map((s) => (
                                <div key={s.name} className="flex gap-2">
                                  <span className="font-mono text-white/80">{s.name}</span>
                                  <span className="text-white/40">{s.description}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {tool.spec.options.length > 0 && (
                            <div>
                              <div className="mb-1 text-[11px] font-medium uppercase text-white/30">Options</div>
                              {tool.spec.options.map((o) => (
                                <div key={o.flags.join(",")} className="flex gap-2">
                                  <span className="font-mono text-white/80">{o.flags.join(", ")}</span>
                                  <span className="text-white/40">{o.description}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[12px] italic text-white/30">Not yet distilled into a structured spec.</div>
                      )}

                      {tool.helpText && (
                        <details className="text-[12px] text-white/50">
                          <summary className="cursor-pointer select-none text-white/40">Raw captured help</summary>
                          <pre className="clide-scroll mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-clide-border bg-clide-bg p-2 font-mono text-[11px] text-white/60">
                            {tool.helpText}
                          </pre>
                        </details>
                      )}

                      {pasteFor === tool.id ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            className={`${inputBase} min-h-[100px] resize-y font-mono text-[12px]`}
                            placeholder="Paste --help output, a README section, or man page text…"
                            value={pasteText}
                            onChange={(e) => setPasteText(e.target.value)}
                          />
                          <ServiceModelPicker value={pasteServiceModel} onChange={setPasteServiceModel} />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setPasteFor(null)}
                              className="rounded-md px-3 py-1.5 text-[13px] text-white/50 hover:bg-white/5"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => void submitPaste(tool.id)}
                              disabled={pasteBusy || !pasteText.trim() || !pasteServiceModel.serviceId}
                              className="rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
                            >
                              {pasteBusy ? "Distilling…" : "Distill"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setPasteFor(tool.id);
                            setPasteText("");
                            setPasteServiceModel(
                              tool.inspectedWith
                                ? { serviceId: tool.inspectedWith.serviceId, model: tool.inspectedWith.model }
                                : { serviceId: "", model: "" },
                            );
                          }}
                          className="self-start text-[12px] text-white/40 hover:text-white/70"
                        >
                          Paste help text instead
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ToolDropZone>
  );
}
