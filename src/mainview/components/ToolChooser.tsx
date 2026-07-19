import { AlertTriangle, Check, RefreshCw, Search, Sparkles, Terminal, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, on } from "../rpc";
import type { NativeTool, ToolRegistryEntry } from "../types/tasks";
import InstallProgressModal from "./InstallProgressModal";
import type { ServiceModelValue } from "./ServiceModelPicker";
import ToolDropZone, { fileToBase64 } from "./ToolDropZone";
import { useUIFeedback } from "./UIFeedback";

const inputBase =
  "rounded-md border border-clide-border bg-clide-surface px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30";

/** A tool the user can pick: a registry entry, or an installed-but-unregistered AI suggestion. */
interface Candidate {
  key: string;
  entry?: ToolRegistryEntry;
  /** For unregistered suggestions: the bare name and its resolved path. */
  name: string;
  execPath: string;
  suggested: boolean;
}

interface Props {
  /** The user's step-1 goal — seeds the AI suggestions and registry matching. */
  goal: string;
  /** Session service+model (picked in step 1) — used for suggestion + inspection calls. */
  serviceModel: ServiceModelValue;
  selected: ToolRegistryEntry | null;
  onSelect: (tool: ToolRegistryEntry | null) => void;
  selectedNative: NativeTool | null;
  onSelectNative: (tool: NativeTool | null) => void;
}

/** Loose goal→tool matching over the cached registry: any goal word appearing in the name or description. */
function matchesGoal(entry: ToolRegistryEntry, goal: string): boolean {
  const words = goal
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);
  if (words.length === 0) return false;
  const hay = `${entry.name} ${entry.spec?.description ?? ""}`.toLowerCase();
  return words.some((w) => hay.includes(w));
}

/**
 * Wizard step 2 (ticket 60): specify or OK the tool. Candidates come from
 * the cached registry (no AI calls for known tools) plus goal-seeded AI
 * suggestions verified installed; inline consent-gated registration for
 * unknown ones; version-aware staleness on cached specs; search, manual
 * resolve, and drag-and-drop as the always-available manual paths.
 * TICKET 99: native tools shown at the very top.
 */
export default function ToolChooser({ goal, serviceModel, selected, onSelect, selectedNative, onSelectNative }: Props) {
  const [nativeTools, setNativeTools] = useState<NativeTool[]>([]);
  const [registry, setRegistry] = useState<ToolRegistryEntry[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [suggestBusy, setSuggestBusy] = useState(false);

  const [search, setSearch] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, toast } = useUIFeedback();

  /** Unregistered pick awaiting the register/inspect decision. */
  const [pendingPick, setPendingPick] = useState<{ name: string; execPath: string } | null>(null);
  const [inspectBusy, setInspectBusy] = useState(false);

  /** Set when the selected cached entry's binary changed since inspection (ticket 60). */
  const [stale, setStale] = useState(false);
  const [reinspectBusy, setReinspectBusy] = useState(false);

  const suggestedForGoal = useRef<string | null>(null);

  // Assemble candidates: registry matches immediately, AI suggestions layered in once.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Load native tools (ticket 99)
      const natives = await api.listNativeTools();
      if (cancelled) return;
      setNativeTools(natives);

      const tools = await api.listTools();
      if (cancelled) return;
      setRegistry(tools);

      const fromRegistry: Candidate[] = tools
        .filter((t) => matchesGoal(t, goal))
        .map((t) => ({ key: t.id, entry: t, name: t.name, execPath: t.execPath, suggested: false }));
      setCandidates(fromRegistry);

      if (!serviceModel.serviceId || suggestedForGoal.current === goal) return;
      suggestedForGoal.current = goal;
      setSuggestBusy(true);
      const res = await api.suggestTools(goal, serviceModel.serviceId, serviceModel.model);
      if (cancelled) return;
      setSuggestBusy(false);
      if (!res.ok || !res.suggestions) return;

      const additions: Candidate[] = [];
      for (const name of res.suggestions) {
        const resolved = await api.resolveTool(name);
        if (!resolved.ok || !resolved.execPath) continue;
        const registered = tools.find((t) => t.execPath === resolved.execPath);
        additions.push(
          registered
            ? {
                key: registered.id,
                entry: registered,
                name: registered.name,
                execPath: registered.execPath,
                suggested: true,
              }
            : { key: `path:${resolved.execPath}`, name, execPath: resolved.execPath, suggested: true },
        );
      }
      if (cancelled) return;
      setCandidates((prev) => {
        const merged = [...prev];
        for (const add of additions) {
          const existing = merged.findIndex((c) => c.execPath === add.execPath);
          if (existing >= 0) merged[existing] = { ...merged[existing]!, suggested: true };
          else merged.push(add);
        }
        return merged;
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, serviceModel.serviceId]);

  /** Reflects a fresh/updated registry entry into every local list so cards don't show stale info. */
  const mergeEntry = (entry: ToolRegistryEntry) => {
    setRegistry((prev) => [...prev.filter((t) => t.id !== entry.id), entry]);
    setCandidates((prev) =>
      prev.map((c) => (c.execPath === entry.execPath ? { ...c, key: entry.id, entry, name: entry.name } : c)),
    );
  };

  /** Picks a registered entry: freshness-check cached specs so stale info is flagged, not silently reused. */
  const pickEntry = async (entry: ToolRegistryEntry) => {
    setPendingPick(null);
    setStale(false);
    onSelect(entry);
    if (!entry.spec) return;
    const res = await api.checkToolFreshness(entry.id);
    if (res.ok && res.entry) {
      if (res.stale) setStale(true);
      mergeEntry(res.entry);
      onSelect(res.entry);
    }
  };

  /** Picks an unregistered candidate: user decides between bare registration and consent-gated inspection. */
  const pickUnregistered = (name: string, execPath: string) => {
    onSelect(null);
    setStale(false);
    setError(null);
    setPendingPick({ name, execPath });
  };

  const registerBare = async () => {
    if (!pendingPick) return;
    setManualBusy(true);
    const res = await api.registerTool(pendingPick.execPath, pendingPick.name, "discovered");
    setManualBusy(false);
    if (!res.ok || !res.entry) {
      setError(res.error ?? "Could not register that tool.");
      return;
    }
    setPendingPick(null);
    mergeEntry(res.entry);
    onSelect(res.entry);
    if (provenancePending.current) {
      const { manager, pkg, version } = provenancePending.current;
      provenancePending.current = null;
      void stampProvenance(res.entry.id, manager, pkg, version);
    }
  };

  const inspectAndPick = async () => {
    if (!pendingPick || !serviceModel.serviceId) return;
    setInspectBusy(true);
    setError(null);
    const res = await api.inspectTool(
      pendingPick.execPath,
      pendingPick.name,
      "discovered",
      serviceModel.serviceId,
      serviceModel.model,
    );
    setInspectBusy(false);
    if (!res.ok || !res.entry) {
      setError(res.error ?? "Inspection failed.");
      return;
    }
    setPendingPick(null);
    mergeEntry(res.entry);
    onSelect(res.entry);
    if (provenancePending.current) {
      const { manager, pkg, version } = provenancePending.current;
      provenancePending.current = null;
      void stampProvenance(res.entry.id, manager, pkg, version);
    }
  };

  const reinspectStale = async () => {
    if (!selected || !serviceModel.serviceId) return;
    setReinspectBusy(true);
    const res = await api.inspectTool(
      selected.execPath,
      selected.name,
      selected.source,
      serviceModel.serviceId,
      serviceModel.model,
    );
    setReinspectBusy(false);
    if (res.ok && res.entry) {
      setStale(false);
      mergeEntry(res.entry);
      onSelect(res.entry);
    }
  };

  const resolveManual = async (nameOrPath: string) => {
    const trimmed = nameOrPath.trim();
    if (!trimmed) return;
    setManualBusy(true);
    setError(null);
    const res = await api.resolveTool(trimmed);
    setManualBusy(false);
    if (!res.ok || !res.execPath) {
      setError(res.error ?? "Could not resolve that tool.");
      return;
    }
    const registered = registry.find((t) => t.execPath === res.execPath);
    if (registered) void pickEntry(registered);
    else pickUnregistered(trimmed, res.execPath);
  };

  // Drag-and-drop a custom executable (tickets 55/60): auto-registers, then joins as the selection.
  const handleDrop = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setManualBusy(true);
    setError(null);
    const base64 = await fileToBase64(file);
    const res = await api.registerDroppedTool(file.name, base64);
    setManualBusy(false);
    if (!res.ok || !res.entry) {
      setError(res.error ?? `Could not register ${file.name}`);
      return;
    }
    mergeEntry(res.entry);
    // Custom tool with no spec yet — offer inspection before use, consent-gated.
    pickUnregistered(res.entry.name, res.entry.execPath);
    onSelect(res.entry);
  };

  // Package manager search
  const [pmResults, setPmResults] = useState<any[] | null>(null);
  const [pmBusy, setPmBusy] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  /** installId → { manager, package } so we know what to bubble up on completion (ticket 103 §4). */
  const installTargets = useRef<Map<string, { manager: string; pkg: string }>>(new Map());
  /** Multiple binaries resolved from one install — user picks which to register. */
  const [binaryChoice, setBinaryChoice] = useState<{
    manager: string;
    pkg: string;
    binaries: { name: string; path: string }[];
  } | null>(null);

  const searchPackageManagers = async (q: string) => {
    setPmBusy(true);
    setPmResults(null);
    const res = await api.searchPackageManagers(q);
    setPmBusy(false);
    if (!res.ok) return setPmResults([]);
    setPmResults(res.results || []);
  };

  /** Stamps installedVia on a freshly registered/inspected entry (ticket 103 §4). */
  const stampProvenance = async (entryId: string, manager: string, pkg: string, version?: string) => {
    const res = await api.setToolInstalledVia(entryId, { manager, package: pkg, version });
    if (res.ok && res.entry) mergeEntry(res.entry);
  };

  /** After a successful install, resolve its binaries and hand off to the existing register/inspect flow. */
  const bubbleUpInstalledBinaries = async (manager: string, pkg: string) => {
    const res = await api.resolvePackageBinaries(manager, pkg);
    if (!res.ok || !res.binaries || res.binaries.length === 0) {
      toast(res.error || `No executables found for "${pkg}"`, "error");
      return;
    }
    if (res.binaries.length === 1) {
      const bin = res.binaries[0]!;
      pickUnregistered(bin.name, bin.path);
      provenancePending.current = { manager, pkg };
      return;
    }
    setBinaryChoice({ manager, pkg, binaries: res.binaries });
  };

  /** Set right before pickUnregistered() when the pick originated from a package install; consumed once
   *  registerBare/inspectAndPick finishes so the resulting entry gets installedVia stamped. */
  const provenancePending = useRef<{ manager: string; pkg: string; version?: string } | null>(null);

  useEffect(() => {
    // listen for install completion — toast, then bubble the binary up into the pick flow
    const unsub = on("status", (update) => {
      if (typeof update.runId === "string" && update.runId.startsWith("install:")) {
        const installId = update.runId.slice("install:".length);
        const target = installTargets.current.get(installId);
        if (update.status === "success") {
          toast("Package installed", "success");
          if (target) void bubbleUpInstalledBinaries(target.manager, target.pkg);
        }
        if (update.status === "error") toast("Package install failed", "error");
        installTargets.current.delete(installId);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchResults =
    search.trim() === "" ? [] : registry.filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <ToolDropZone onFiles={(files) => void handleDrop(files)} className="flex flex-col gap-4">
      {/* Native tools (ticket 99) — always at the top */}
      {nativeTools.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-white/70">
            <Terminal size={13} className="text-white/70" />
            Native
          </div>
          <div className="flex flex-col gap-1.5">
            {nativeTools.map((nt) => {
              const isSelected = selectedNative?.id === nt.id;
              return (
                <button
                  key={nt.id}
                  onClick={() => onSelectNative(nt)}
                  className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors ${
                    isSelected
                      ? "border-white/30 bg-white/10"
                      : "border-clide-border bg-clide-surface hover:border-white/20"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                      isSelected ? "bg-green-500/20 text-green-400" : "bg-white/5 text-white/20"
                    }`}
                  >
                    {isSelected ? <Check size={12} /> : <Terminal size={11} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] text-white">
                        {nt.icon} {nt.name}
                      </span>
                      <span className="shrink-0 rounded-full bg-blue-400/10 px-1.5 py-0.5 text-[10px] uppercase text-blue-300/70">
                        native
                      </span>
                    </span>
                    <span className="block text-[12px] text-white/40">{nt.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Candidates */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-white/70">
          <Sparkles size={13} className="text-amber-300/70" />
          Suggested for your goal
          {suggestBusy && <span className="text-[12px] font-normal text-white/30">— asking the AI…</span>}
        </div>
        {candidates.length === 0 && !suggestBusy && (
          <div className="text-[13px] text-white/30">
            No matches yet — search below, type a name, or drop an executable in.
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          {candidates.map((c) => {
            const isSelected = selected ? selected.execPath === c.execPath : pendingPick?.execPath === c.execPath;
            return (
              <button
                key={c.key}
                onClick={() => (c.entry ? void pickEntry(c.entry) : pickUnregistered(c.name, c.execPath))}
                className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors ${
                  isSelected
                    ? "border-white/30 bg-white/10"
                    : "border-clide-border bg-clide-surface hover:border-white/20"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    isSelected ? "bg-green-500/20 text-green-400" : "bg-white/5 text-white/20"
                  }`}
                >
                  {isSelected ? <Check size={12} /> : <Wrench size={11} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px] text-white">{c.name}</span>
                    {c.entry && (
                      <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-white/40">
                        {c.entry.source}
                      </span>
                    )}
                    {!c.entry && (
                      <span className="shrink-0 rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[10px] uppercase text-amber-300/70">
                        not registered
                      </span>
                    )}
                    {c.suggested && (
                      <Sparkles size={11} className="shrink-0 text-amber-300/50" aria-label="AI-suggested" />
                    )}
                  </span>
                  <span className="block truncate text-[12px] text-white/40">
                    {c.entry?.spec?.description || c.execPath}
                  </span>
                  {c.entry?.inspectedAt && (
                    <span className="block text-[11px] text-white/25">
                      Inspected {new Date(c.entry.inspectedAt).toLocaleDateString()}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stale cache banner (ticket 60) */}
      {selected && stale && (
        <div className="flex items-center gap-2 rounded-md border border-amber-400/30 bg-amber-400/5 px-3 py-2">
          <RefreshCw size={13} className="shrink-0 text-amber-300" />
          <span className="min-w-0 flex-1 text-[12px] text-amber-200">
            {selected.name} changed since it was inspected — its cached info may be outdated.
          </span>
          {serviceModel.serviceId && (
            <button
              onClick={() => void reinspectStale()}
              disabled={reinspectBusy}
              className="shrink-0 rounded-md bg-amber-400/80 px-2.5 py-1 text-[12px] font-medium text-black hover:bg-amber-400 disabled:opacity-40"
            >
              {reinspectBusy ? "Re-inspecting…" : "Re-inspect"}
            </button>
          )}
          <button
            onClick={() => setStale(false)}
            className="shrink-0 rounded-md px-2 py-1 text-[12px] text-white/50 hover:bg-white/5"
          >
            Keep cached
          </button>
        </div>
      )}

      {/* Register/inspect decision for an unregistered pick */}
      {pendingPick && (
        <div className="flex flex-col gap-2 rounded-lg border border-clide-border bg-clide-surface p-3">
          <div className="text-[13px] text-white/70">
            Use <span className="font-mono text-white">{pendingPick.execPath}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void registerBare()}
              disabled={manualBusy}
              className="rounded-md px-3 py-1.5 text-[13px] text-white/70 hover:bg-white/5 hover:text-white disabled:opacity-40"
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
                  onClick={() => void inspectAndPick()}
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

      {error && <span className="text-[12px] text-red-400">{error}</span>}

      {/* Manual paths — always available, AI never gates. */}
      <div className="flex flex-col gap-2 border-t border-clide-border pt-4">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-white/70">
          <Search size={13} className="text-white/40" />
          Search registered tools
        </div>
        <input className={inputBase} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {searchResults.length > 0 && (
          <div className="clide-scroll flex max-h-40 flex-col gap-0.5 overflow-y-auto">
            {searchResults.map((t) => (
              <button
                key={t.id}
                onClick={() => void pickEntry(t)}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-white/70 hover:bg-white/5 hover:text-white"
              >
                <Wrench size={12} className="shrink-0 text-white/30" />
                <span className="truncate">{t.name}</span>
                <span className="truncate text-[11px] text-white/30">{t.spec?.description}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-white/70">
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
        <div className="border-t border-clide-border pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-white/70">
              <Search size={13} className="text-white/40" />
              Search package managers
            </div>
            <div className="text-[12px] text-white/40">{pmBusy ? "Searching…" : null}</div>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              className={`${inputBase} min-w-0 flex-1`}
              placeholder="search package managers…"
              onKeyDown={(e) => {
                if (e.key === "Enter") searchPackageManagers((e.target as HTMLInputElement).value);
              }}
            />
            <button
              onClick={async () => searchPackageManagers((document.activeElement as HTMLInputElement)?.value || "")}
              className="shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20"
            >
              Search
            </button>
          </div>
          {pmResults && (
            <div className="mt-3 flex flex-col gap-2">
              {pmResults.length === 0 && <div className="text-[13px] text-white/30">No results</div>}
              {pmResults.map((mgr) => (
                <div key={mgr.id} className="rounded-md border border-clide-border p-2">
                  <div className="flex items-center justify-between">
                    <div className="text-white font-medium">{mgr.name}</div>
                    <div className="text-[12px] text-white/40">{mgr.ok ? "available" : "unavailable"}</div>
                  </div>
                  <div className="mt-2 flex flex-col gap-1">
                    {(mgr.results || []).map((r: any) => (
                      <div key={r.name} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-white">{r.name}</div>
                          <div className="text-[12px] text-white/40 truncate">{r.desc}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              const cmd =
                                mgr.id === "homebrew"
                                  ? `brew install ${r.name}`
                                  : mgr.id === "npm"
                                    ? `bun add -g ${r.name} (or npm install -g --yes ${r.name})`
                                    : mgr.id === "pipx"
                                      ? `pipx install ${r.name}`
                                      : mgr.id === "cargo"
                                        ? `cargo install ${r.name}`
                                        : `${mgr.id} install ${r.name}`;
                              const confirmed = await confirm({
                                title: "Install package",
                                message: `Command: ${cmd}`,
                                confirmLabel: "Install",
                              });
                              if (!confirmed.ok) return;
                              const res = await api.installPackage(mgr.id, r.name);
                              if (!res.ok) {
                                toast(res.error || "Install failed", "error");
                                return;
                              }
                              if (res.installId) {
                                installTargets.current.set(res.installId, { manager: mgr.id, pkg: r.name });
                                setInstallingId(res.installId);
                              }
                            }}
                            className="rounded-md bg-white/10 px-3 py-1 text-[13px] text-white hover:bg-white/20"
                          >
                            Install
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {installingId && <InstallProgressModal installId={installingId} onClose={() => setInstallingId(null)} />}
      {binaryChoice && (
        <div className="mt-3 rounded-md border border-clide-border p-3">
          <div className="text-[13px] font-medium text-white/70">
            "{binaryChoice.pkg}" provided {binaryChoice.binaries.length} executables — pick one to register:
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {binaryChoice.binaries.map((bin) => (
              <button
                key={bin.path}
                onClick={() => {
                  pickUnregistered(bin.name, bin.path);
                  provenancePending.current = { manager: binaryChoice.manager, pkg: binaryChoice.pkg };
                  setBinaryChoice(null);
                }}
                className="rounded-md border border-clide-border px-3 py-1.5 text-left text-[13px] text-white hover:bg-white/5"
              >
                <span className="font-medium">{bin.name}</span> <span className="text-white/40">{bin.path}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setBinaryChoice(null)} className="mt-2 text-[12px] text-white/40 hover:text-white/70">
            Cancel
          </button>
        </div>
      )}
    </ToolDropZone>
  );
}
