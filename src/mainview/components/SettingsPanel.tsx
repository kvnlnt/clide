import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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

  // Escape closes the page, same as the top-right ×.
  const handleClose = useCallback(() => onClose(), [onClose]);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

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
    <div className="flex flex-1 flex-col">
      {/* Page header — stays put while the body scrolls, keeping × reachable. */}
      <div className="flex shrink-0 items-center justify-between px-8 pb-4 pt-7">
        <h1 className="text-[20px] font-bold text-white">Settings</h1>
        <button
          onClick={handleClose}
          title="Close settings"
          className="flex h-8 w-8 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="clide-scroll flex-1 overflow-y-auto px-8 pb-8">
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-8">
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

          <div className="flex">
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-md bg-white/10 px-4 py-2 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-50"
            >
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
