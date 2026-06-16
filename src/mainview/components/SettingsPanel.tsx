import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../rpc";
import type { AIProvider } from "../types/forms";

interface SettingsPanelProps {
  onClose: () => void;
}

const PROVIDERS: { id: AIProvider; label: string; needsKey: boolean }[] = [
  { id: "claude", label: "Claude (Anthropic)", needsKey: true },
  { id: "openai", label: "OpenAI", needsKey: true },
  { id: "ollama", label: "Ollama (local)", needsKey: false },
];

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://localhost:11434");
  const [keys, setKeys] = useState<Partial<Record<AIProvider, string>>>({});
  const [savedKeys, setSavedKeys] = useState<Partial<Record<AIProvider, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void api.getAISettings().then((s) => {
      setOllamaBaseUrl(s.ollamaBaseUrl ?? "http://localhost:11434");
    });
    for (const p of PROVIDERS) {
      if (p.needsKey) {
        void api.hasCredentials(p.id).then((has) => setSavedKeys((prev) => ({ ...prev, [p.id]: has })));
      }
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await api.saveAISettings({ ollamaBaseUrl: ollamaBaseUrl.trim() || "http://localhost:11434" });
    for (const p of PROVIDERS) {
      const key = keys[p.id]?.trim();
      if (key) {
        await api.saveCredentials(p.id, key);
        setSavedKeys((prev) => ({ ...prev, [p.id]: true }));
      }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputBase =
    "w-full rounded-md border border-clide-border bg-clide-surface px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30";

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center bg-black/50 pt-16" onMouseDown={onClose}>
      <div
        className="w-[480px] overflow-hidden rounded-lg border border-clide-border bg-clide-panel shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-clide-border px-5 py-4">
          <span className="text-[14px] font-bold text-white">Settings</span>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-6 px-5 py-5">
          {/* AI Provider Keys */}
          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-bold uppercase tracking-wider text-white/40">AI Providers</span>

            {PROVIDERS.filter((p) => p.needsKey).map((p) => (
              <div key={p.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <label className="text-[13px] font-medium text-white/80">{p.label}</label>
                  {savedKeys[p.id] && (
                    <span className="rounded-full bg-green-500/20 px-1.5 py-0.5 text-[10px] font-medium text-green-400">
                      key saved
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  className={inputBase}
                  placeholder={savedKeys[p.id] ? "••••••••••••  (leave blank to keep)" : "API key"}
                  value={keys[p.id] ?? ""}
                  onChange={(e) => setKeys((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  autoComplete="off"
                />
              </div>
            ))}
          </div>

          {/* Ollama Configuration */}
          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-bold uppercase tracking-wider text-white/40">Ollama</span>
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-white/80">Base URL</label>
              <input
                className={inputBase}
                placeholder="http://localhost:11434"
                value={ollamaBaseUrl}
                onChange={(e) => setOllamaBaseUrl(e.target.value)}
              />
              <span className="text-[11px] text-white/30">
                Default: http://localhost:11434 — change if Ollama runs on a different host or port.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-clide-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-[13px] text-white/50 hover:bg-white/5 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-50"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
