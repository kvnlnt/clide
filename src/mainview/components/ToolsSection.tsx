import { AlertTriangle, ChevronDown, ChevronRight, PlayCircle, Terminal, Trash2, Upload, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../rpc";
import type { ToolRegistryEntry } from "../types/tasks";
import ServiceModelPicker, { type ServiceModelValue } from "./ServiceModelPicker";
import ToolDropZone, { fileToBase64 } from "./ToolDropZone";
import ToolTestModal from "./ToolTestModal";
import { useUIFeedback } from "./UIFeedback";

const inputBase =
  "rounded-md border border-clide-border bg-clide-bg px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30";

interface PendingRun {
  mode: "add" | "reinspect";
  nameOrPath: string;
  displayName?: string;
  execPath: string;
  serviceModel: ServiceModelValue;
}

/**
 * Tool registry manager (tickets 53/55/57), rendered as a Settings section
 * below AI Services — the registry is machine-global, so it lives with the
 * other global configuration rather than on any project's toolbar. Resolve
 * & inspect installed CLI tools (consent-gated), re-inspect, paste-help
 * distillation, rename/remove, and drag-and-drop registration.
 */
export default function ToolsSection() {
  const [tools, setTools] = useState<ToolRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [addName, setAddName] = useState("");
  const [addServiceModel, setAddServiceModel] = useState<ServiceModelValue>({ serviceId: "", model: "" });
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [pending, setPending] = useState<PendingRun | null>(null);
  const [pendingBusy, setPendingBusy] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const [testTool, setTestTool] = useState<ToolRegistryEntry | null>(null);

  const [pasteFor, setPasteFor] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [pasteServiceModel, setPasteServiceModel] = useState<ServiceModelValue>({ serviceId: "", model: "" });
  const [pasteBusy, setPasteBusy] = useState(false);

  // Drag-and-drop registration queue (ticket 55) — one consent gate at a time.
  const [dropQueue, setDropQueue] = useState<File[]>([]);
  const [dropBusy, setDropBusy] = useState(false);

  const { confirm, toast } = useUIFeedback();
  const [installBusy, setInstallBusy] = useState(false);

  /** Entry ids whose binary changed since inspection (ticket 60) — checked lazily on expand. */
  const [staleIds, setStaleIds] = useState<Set<string>>(new Set());
  const freshnessChecked = useRef<Set<string>>(new Set());

  const toggleExpanded = (tool: ToolRegistryEntry) => {
    const opening = expandedId !== tool.id;
    setExpandedId(opening ? tool.id : null);
    // Version-aware cache check (ticket 60): compare fingerprints once per
    // session when a previously inspected entry is opened.
    if (opening && tool.spec && !freshnessChecked.current.has(tool.id)) {
      freshnessChecked.current.add(tool.id);
      void api.checkToolFreshness(tool.id).then((res) => {
        if (res.ok && res.stale) setStaleIds((prev) => new Set(prev).add(tool.id));
      });
    }
  };

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
      setAddOpen(false);
    }
    if (res.error) setAddError(res.error); // distillation-only failure — entry still saved with raw help text
    // A fresh inspection re-baselines the fingerprint — drop any stale badge.
    if (res.entry) {
      setStaleIds((prev) => {
        const next = new Set(prev);
        next.delete(res.entry!.id);
        return next;
      });
      freshnessChecked.current.delete(res.entry.id);
    }
    refresh();
  };

  const remove = async (tool: ToolRegistryEntry) => {
    const res = await confirm({
      title: `Remove tool "${tool.name}"?`,
      message: tool.installedVia
        ? `Tasks that use it will fail at run time until it's registered again. This only removes it from CLIDE's registry — the "${tool.installedVia.package}" package installed via ${tool.installedVia.manager} stays on your system (ticket 103: uninstall is out of scope).`
        : "Tasks that use it will fail at run time until it's registered again.",
      confirmLabel: "Remove",
      // Only copied-in custom installs own a binary CLIDE may delete (ticket 58).
      checkboxLabel: tool.sourceHash ? "Also delete the copied executable" : undefined,
      checkboxDefault: true,
    });
    if (!res.ok) return;
    await api.removeTool(tool.id, tool.sourceHash !== undefined && res.checked);
    toast("Tool removed");
    refresh();
  };

  /** Ticket 58: install a custom tool via the native file picker — the copy in app storage becomes the tool. */
  const installFromPicker = async () => {
    setInstallBusy(true);
    setAddError(null);
    const path = await api.chooseFile();
    if (!path) {
      setInstallBusy(false);
      return;
    }
    const res = await api.installToolFromPath(path);
    setInstallBusy(false);
    if (!res.ok || !res.entry) {
      setAddError(res.error ?? "Could not install that tool.");
      return;
    }
    refresh();
    // Same consent-gated inspection as a drop: nothing executes without an OK.
    setPending({
      mode: "add",
      nameOrPath: res.entry.execPath,
      displayName: res.entry.name,
      execPath: res.entry.execPath,
      serviceModel: addServiceModel,
    });
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
    <ToolDropZone onFiles={(files) => setDropQueue((q) => [...q, ...files])} className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-wider text-white/40">Tools</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => void installFromPicker()}
            disabled={installBusy}
            title="Upload an executable — it only needs to support --help"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-white/60 hover:bg-white/5 hover:text-white disabled:opacity-40"
          >
            <Upload size={13} /> {installBusy ? "Installing…" : "Install custom tool…"}
          </button>
          {!addOpen && (
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-white/60 hover:bg-white/5 hover:text-white"
            >
              <Wrench size={13} /> Add tool
            </button>
          )}
        </div>
      </div>
      <span className="text-[12px] text-white/30">
        Custom tools are copied into CLIDE's own storage and reusable forever — they only need to support{" "}
        <span className="font-mono">--help</span> so CLIDE can document them.
      </span>

      {/* Add tool by name/path */}
      {addOpen && (
        <div className="flex flex-col gap-2 rounded-md border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center gap-2">
            <input
              autoFocus
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
            <span className="text-[12px] text-white/30">
              Resolves on PATH, then asks to confirm before running --help.
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setAddOpen(false);
                  setAddError(null);
                }}
                className="rounded-md px-3 py-1.5 text-[12px] text-white/50 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => void startAdd()}
                disabled={addBusy || !addInput.trim()}
                className="rounded-md bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
              >
                {addBusy ? "Resolving…" : "Resolve & inspect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {addError && <span className="text-[12px] text-red-400">{addError}</span>}

      {/* Consent-gated inspection confirm (ticket 53) */}
      {pending && (
        <div className="flex flex-col gap-2 rounded-md border border-amber-400/30 bg-amber-400/5 p-3">
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
        <div className="text-[13px] italic text-white/30">Loading…</div>
      ) : tools.length === 0 ? (
        <div className="rounded-md border border-dashed border-clide-border px-3 py-4 text-center text-[13px] text-white/40">
          No tools registered yet. Add one above, or drag an executable onto this section.
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/5 rounded-md border border-clide-border">
          {tools.map((tool) => {
            const expanded = expandedId === tool.id;
            return (
              <div key={tool.id} className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleExpanded(tool)}
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
                        {staleIds.has(tool.id) && (
                          <span
                            className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
                            title="The binary changed since it was inspected — re-inspect to refresh its cached info"
                          >
                            changed since inspection
                          </span>
                        )}
                      </div>
                      <span className="truncate text-[12px] text-white/40">
                        {tool.spec?.description || tool.execPath}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => setTestTool(tool)}
                    title="Run this tool with your own arguments"
                    className="flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-[12px] text-white/60 hover:bg-white/5 hover:text-white"
                  >
                    <PlayCircle size={12} /> Test
                  </button>
                  <button
                    onClick={() => startReinspect(tool)}
                    className="shrink-0 rounded-md px-2.5 py-1 text-[12px] text-white/60 hover:bg-white/5 hover:text-white"
                  >
                    Re-inspect
                  </button>
                  <button
                    onClick={() => void remove(tool)}
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

      {testTool && <ToolTestModal tool={testTool} onClose={() => setTestTool(null)} />}
    </ToolDropZone>
  );
}
