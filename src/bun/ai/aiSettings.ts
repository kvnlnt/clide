import type { AISettings } from "../../shared/types";
import { aiSettingsPath, appDataDir, ensureDir } from "../paths";

const DEFAULTS: AISettings = {
  ollamaBaseUrl: "http://localhost:11434",
};

let cached: AISettings | null = null;

export async function loadAISettings(): Promise<AISettings> {
  if (cached) return cached;
  try {
    const file = Bun.file(aiSettingsPath());
    if (await file.exists()) {
      const parsed = JSON.parse(await file.text()) as Partial<AISettings>;
      cached = { ...DEFAULTS, ...parsed };
      return cached;
    }
  } catch {
    // fall through to defaults
  }
  cached = { ...DEFAULTS };
  return cached;
}

export async function saveAISettings(settings: AISettings): Promise<void> {
  cached = { ...DEFAULTS, ...settings };
  ensureDir(appDataDir());
  await Bun.write(aiSettingsPath(), JSON.stringify(cached, null, 2));
}

export async function getOllamaBaseUrl(): Promise<string> {
  const s = await loadAISettings();
  return s.ollamaBaseUrl?.trim() || DEFAULTS.ollamaBaseUrl;
}
