import { Activity, Check, ChevronDown, ChevronRight, Loader, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../rpc";
import type { AIService, AIServiceKind } from "../types/tasks";
import { AI_SERVICE_KIND_LABEL, AI_SERVICE_KIND_NEEDS_BASE_URL } from "../types/tasks";
import { FilesPage } from "./files/FilesPage";
import { useEscapeToClose } from "./Modal";
import PackageManagersSection from "./PackageManagersSection";
import ProfileSettingsSection from "./ProfileSettingsSection";
import ToolsSection from "./ToolsSection";
import { useUIFeedback } from "./UIFeedback";

interface SettingsPanelProps {
  onClose: () => void;
}

const KINDS: AIServiceKind[] = ["anthropic", "openai", "openai-compatible", "ollama"];

function needsCredential(kind: AIServiceKind): boolean {
  return kind === "anthropic" || kind === "openai";
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { compactMode, setCompactMode, openDiagnostics } = useApp();
  const { confirm, toast } = useUIFeedback();
  const [services, setServices] = useState<AIService[] | null>(null);
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    const list = await api.listAIServices();
    setServices(list);
    const keyed = list.filter((s) => needsCredential(s.kind));
    const flags = await Promise.all(keyed.map((s) => api.hasServiceCredential(s.id)));
    setSavedKeys(Object.fromEntries(keyed.map((s, i) => [s.id, flags[i]])));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Escape closes the page, same as the top-right × — paused while an editor is open (ticket 75).
  const handleClose = useCallback(() => onClose(), [onClose]);
  useEscapeToClose(handleClose, !editingId && !creating);

  const persist = async (next: AIService[]) => {
    setServices(next);
    await api.saveAIServices(next);
  };

  const setDefault = async (id: string) => {
    if (!services) return;
    await persist(services.map((s) => ({ ...s, isDefault: s.id === id })));
  };

  const remove = async (service: AIService) => {
    if (!services) return;
    const res = await confirm({
      title: `Delete AI service "${service.name}"?`,
      message: "Features using it fall back to the default service; its saved API key stays in the keychain.",
      confirmLabel: "Delete",
    });
    if (!res.ok) return;
    const remaining = services.filter((s) => s.id !== service.id);
    if (remaining.length > 0 && !remaining.some((s) => s.isDefault)) remaining[0]!.isDefault = true;
    await persist(remaining);
    toast("Service deleted");
  };

  return (
    // min-h-0: as a flex child of the full-window overlay column, the default
    // min-height:auto let this grow past the window instead of the body
    // scrolling once sections expanded (ticket 68).
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Page header — stays put while the body scrolls, keeping × reachable. */}
      <div className="flex shrink-0 items-center justify-between px-[var(--clide-page-x)] pb-4 pt-[var(--clide-page-top)]">
        <h1 className="text-[20px] font-bold text-white">Settings</h1>
        <button
          onClick={handleClose}
          title="Close settings"
          className="flex h-8 w-8 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="clide-scroll flex-1 overflow-y-auto px-[var(--clide-page-x)] pb-[var(--clide-page-bottom)]">
        <div className="flex w-full max-w-[820px] flex-col gap-3">
          <div className="flex flex-col gap-3 border-b border-white/5 pb-4">
            <span className="text-[12px] font-bold uppercase tracking-wider text-white/40">Appearance</span>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={compactMode}
                onChange={(e) => setCompactMode(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-clide-surface text-white focus:ring-0 focus:ring-offset-0"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium text-white/80">Compact mode</span>
                <span className="text-[12px] text-white/40">
                  Tighter margins and denser rows across the thread, tasks, views, and calendar
                </span>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] font-bold uppercase tracking-wider text-white/40">Diagnostics</span>
              <span className="text-[12px] text-white/40">App/machine health, resource usage, AI service reachability</span>
            </div>
            <button
              onClick={openDiagnostics}
              className="flex items-center gap-1.5 rounded-md border border-clide-border px-2.5 py-1.5 text-[12px] text-white/70 hover:bg-white/5 hover:text-white"
            >
              <Activity size={13} /> Open
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold uppercase tracking-wider text-white/40">AI Services</span>
            {!creating && (
              <button
                onClick={() => {
                  setCreating(true);
                  setEditingId(null);
                }}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-white/60 hover:bg-white/5 hover:text-white"
              >
                <Plus size={13} /> Add service
              </button>
            )}
          </div>

          {services === null && <div className="text-[13px] italic text-white/30">Loading…</div>}

          {services?.length === 0 && !creating && (
            <div className="rounded-md border border-dashed border-clide-border px-3 py-4 text-center text-[13px] text-white/40">
              No AI services configured yet. Add one to enable AI-powered task creation and magic fields.
            </div>
          )}

          {creating && (
            <AIServiceEditor
              onCancel={() => setCreating(false)}
              onSave={async (service, apiKey) => {
                if (apiKey.trim()) await api.saveServiceCredential(service.id, apiKey.trim());
                const next = [...(services ?? []), service];
                if (!next.some((s) => s.isDefault)) service.isDefault = true;
                await persist(next);
                setCreating(false);
              }}
            />
          )}

          {services && services.length > 0 && (
            <div className="flex flex-col divide-y divide-white/5 rounded-md border border-clide-border">
              {services.map((service) =>
                editingId === service.id ? (
                  <div key={service.id} className="px-3 py-2.5">
                    <AIServiceEditor
                      existing={service}
                      hasSavedKey={savedKeys[service.id] === true}
                      onCancel={() => setEditingId(null)}
                      onSave={async (updated, apiKey) => {
                        if (apiKey.trim()) await api.saveServiceCredential(updated.id, apiKey.trim());
                        await persist(services.map((s) => (s.id === updated.id ? updated : s)));
                        await refresh();
                        setEditingId(null);
                      }}
                    />
                  </div>
                ) : (
                  <ServiceRow
                    key={service.id}
                    service={service}
                    hasSavedKey={savedKeys[service.id] === true}
                    onEdit={() => {
                      setEditingId(service.id);
                      setCreating(false);
                    }}
                    onSetDefault={() => void setDefault(service.id)}
                    onDelete={() => void remove(service)}
                  />
                ),
              )}
            </div>
          )}

          {/* Who CLIDE is working for (ticket 100) — app-scoped profile. */}
          <div className="mt-6">
            <ProfileSettingsSection scope="app" />
          </div>

          {/* Tools registry (ticket 57) — machine-global, so it lives here, not on a project toolbar. */}
          <div className="mt-6">
            <ToolsSection />
          </div>
          <div className="mt-6">
            <PackageManagersSection />
          </div>

          {/* Files (ticket 102) — app-scoped VFS locations. */}
          <div className="mt-6">
            <FilesSection />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Files section for app-scoped VFS locations (ticket 102). */
function FilesSection() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-[12px] font-bold uppercase tracking-wider text-white/40 hover:bg-white/5"
      >
        <span>Files</span>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {expanded && (
        <div className="mt-2 rounded-md border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="h-[500px]">
            <FilesPage scope="app" />
          </div>
        </div>
      )}
    </div>
  );
}

interface ServiceRowProps {
  service: AIService;
  hasSavedKey: boolean;
  onEdit: () => void;
  onSetDefault: () => void;
  /** Confirmation happens upstream (shared confirm dialog) — this fires the delete directly. */
  onDelete: () => void;
}

function ServiceRow({ service, hasSavedKey, onEdit, onSetDefault, onDelete }: ServiceRowProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await api.testAIService(service.id);
    setTesting(false);
    setTestResult(res);
  };

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-3">
        <button
          onClick={onSetDefault}
          title={service.isDefault ? "Default service" : "Make default"}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${
            service.isDefault ? "text-amber-300" : "text-white/20 hover:bg-white/10 hover:text-white/60"
          }`}
        >
          <Star size={14} fill={service.isDefault ? "currentColor" : "none"} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] text-white">{service.name}</span>
            <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-white/40">
              {AI_SERVICE_KIND_LABEL[service.kind]}
            </span>
            {needsCredential(service.kind) &&
              (hasSavedKey ? (
                <span className="shrink-0 rounded-full bg-green-500/20 px-1.5 py-0.5 text-[10px] font-medium text-green-400">
                  key saved
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                  no key
                </span>
              ))}
            {service.model && <span className="shrink-0 truncate text-[11px] text-white/30">{service.model}</span>}
          </div>
          {testResult && (
            <div className={`mt-1 text-[11px] ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
              {testResult.ok ? "Test succeeded" : `Test failed: ${testResult.error}`}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => void runTest()}
            disabled={testing}
            title="Test this service"
            className="flex h-7 w-7 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            {testing ? <Loader size={13} className="animate-spin" /> : <Check size={13} />}
          </button>
          <button
            onClick={onEdit}
            title="Edit"
            className="flex h-7 w-7 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            className="flex h-7 w-7 items-center justify-center rounded text-red-400/70 hover:bg-white/10 hover:text-red-400"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

export interface AIServiceEditorProps {
  existing?: AIService;
  hasSavedKey?: boolean;
  /** Pre-selects the kind dropdown for a fresh (non-`existing`) service — the first-run wizard (ticket 76) seeds this from the local/remote choice. */
  initialKind?: AIServiceKind;
  onSave: (service: AIService, apiKey: string) => Promise<void>;
  onCancel: () => void;
}

export function AIServiceEditor({ existing, hasSavedKey, initialKind, onSave, onCancel }: AIServiceEditorProps) {
  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<AIServiceKind>(existing?.kind ?? initialKind ?? "anthropic");
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [model, setModel] = useState(existing?.model ?? "");
  const [timeoutMs, setTimeoutMs] = useState(existing?.timeoutMs ? String(existing.timeoutMs) : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const inputBase =
    "w-full rounded-md border border-clide-border bg-clide-bg px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30";

  const requiresBaseUrl = AI_SERVICE_KIND_NEEDS_BASE_URL[kind];

  const save = async () => {
    if (!name.trim()) {
      setError("Name required");
      return;
    }
    if (requiresBaseUrl && !baseUrl.trim()) {
      setError("Base URL required for this service kind");
      return;
    }
    setSaving(true);
    setError(null);
    const service: AIService = {
      id: existing?.id ?? crypto.randomUUID(),
      name: name.trim(),
      kind,
      baseUrl: baseUrl.trim() || undefined,
      model: model.trim() || undefined,
      timeoutMs: timeoutMs.trim() ? Number(timeoutMs.trim()) : undefined,
      isDefault: existing?.isDefault,
    };
    await onSave(service, apiKey);
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-white/10 bg-white/[0.02] p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-white/50">Name</label>
          <input
            autoFocus
            className={inputBase}
            placeholder="Work Claude"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-white/50">Kind</label>
          <select
            className={`${inputBase} appearance-none`}
            value={kind}
            onChange={(e) => setKind(e.target.value as AIServiceKind)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k} className="bg-clide-panel">
                {AI_SERVICE_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {requiresBaseUrl && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-white/50">Base URL</label>
          <input
            className={inputBase}
            placeholder={kind === "ollama" ? "http://localhost:11434" : "https://your-server/v1"}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>
      )}

      {needsCredential(kind) && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-white/50">API Key</label>
          <input
            type="password"
            className={inputBase}
            placeholder={hasSavedKey ? "••••••••••••  (leave blank to keep)" : "API key"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
          />
        </div>
      )}
      {kind === "openai-compatible" && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-white/50">API Key (optional)</label>
          <input
            type="password"
            className={inputBase}
            placeholder={hasSavedKey ? "••••••••••••  (leave blank to keep)" : "Only if the endpoint requires one"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
          />
        </div>
      )}

      <button
        onClick={() => setAdvancedOpen((o) => !o)}
        className="flex items-center gap-1 self-start text-[11px] font-medium text-white/40 hover:text-white/70"
      >
        {advancedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Advanced
      </button>

      {advancedOpen && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-white/50">Model override</label>
            <input
              className={inputBase}
              placeholder="Uses a sensible default when blank"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>
          {!requiresBaseUrl && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-white/50">Base URL override</label>
              <input
                className={inputBase}
                placeholder="Uses the standard hosted endpoint when blank"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-white/50">Timeout (ms)</label>
            <input
              className={inputBase}
              placeholder="Default"
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(e.target.value)}
            />
          </div>
        </div>
      )}

      {error && <span className="text-[11px] text-red-400">{error}</span>}

      <div className="flex gap-1.5">
        <button
          disabled={saving}
          onClick={() => void save()}
          className="rounded-md bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={onCancel} className="rounded-md px-3 py-1.5 text-[12px] text-white/50 hover:bg-white/5">
          Cancel
        </button>
      </div>
    </div>
  );
}
