import type { AIProvider, AIService, AIServiceKind } from "../../shared/types";
import { DEFAULT_MODEL_FOR_KIND } from "../../shared/types";
import { aiServicesPath, aiSettingsPath, appDataDir, ensureDir } from "../paths";
import { complete } from "./providers";
import { getCredential, getLegacyCredential, saveCredential } from "./credentials";

let cached: AIService[] | null = null;

function legacyProviderToKind(p: AIProvider): AIServiceKind {
  if (p === "claude") return "anthropic";
  if (p === "openai") return "openai";
  return "ollama";
}

/** Best-effort mapping back to the old fixed union, for legacy `FormMeta.aiProvider`. */
export function legacyProviderForKind(kind: AIServiceKind): AIProvider {
  if (kind === "anthropic") return "claude";
  if (kind === "ollama") return "ollama";
  return "openai"; // openai + openai-compatible both map to the closest legacy fit
}

/** One-time migration from the old fixed claude/openai/ollama settings into services. */
async function migrate(): Promise<AIService[]> {
  const services: AIService[] = [];

  const legacy: { provider: AIProvider; name: string }[] = [
    { provider: "claude", name: "Claude (Anthropic)" },
    { provider: "openai", name: "OpenAI" },
  ];
  for (const { provider, name } of legacy) {
    const key = await getLegacyCredential(provider);
    if (!key) continue;
    const id = crypto.randomUUID();
    await saveCredential(id, key);
    services.push({ id, name, kind: legacyProviderToKind(provider) });
  }

  try {
    const file = Bun.file(aiSettingsPath());
    if (await file.exists()) {
      const parsed = JSON.parse(await file.text()) as { ollamaBaseUrl?: string };
      if (parsed.ollamaBaseUrl?.trim()) {
        services.push({
          id: crypto.randomUUID(),
          name: "Ollama (local)",
          kind: "ollama",
          baseUrl: parsed.ollamaBaseUrl.trim(),
        });
      }
    }
  } catch {
    // no legacy ai-settings.json — nothing to migrate
  }

  if (services.length > 0) services[0]!.isDefault = true;
  return services;
}

export async function listAIServices(): Promise<AIService[]> {
  if (cached) return cached;
  try {
    const file = Bun.file(aiServicesPath());
    if (await file.exists()) {
      cached = JSON.parse(await file.text()) as AIService[];
      return cached;
    }
  } catch {
    // fall through to migration
  }
  cached = await migrate();
  ensureDir(appDataDir());
  await Bun.write(aiServicesPath(), JSON.stringify(cached, null, 2));
  return cached;
}

export async function saveAIServices(services: AIService[]): Promise<void> {
  cached = services;
  ensureDir(appDataDir());
  await Bun.write(aiServicesPath(), JSON.stringify(cached, null, 2));
}

export async function getAIService(id: string): Promise<AIService | undefined> {
  const services = await listAIServices();
  return services.find((s) => s.id === id);
}

export async function getDefaultAIService(): Promise<AIService | undefined> {
  const services = await listAIServices();
  return services.find((s) => s.isDefault) ?? services[0];
}

/**
 * Curated model lists for the hosted kinds (ticket 59) — their model-listing
 * APIs aren't worth a keyed call for a picker; local kinds are live-queried.
 */
const CURATED_MODELS: Record<"anthropic" | "openai", string[]> = {
  anthropic: ["claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5-20251001", "claude-3-5-sonnet-latest"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o3-mini"],
};

const MODEL_QUERY_TIMEOUT_MS = 3000;

async function queryOllamaModels(baseUrl: string): Promise<string[]> {
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/tags`, {
    signal: AbortSignal.timeout(MODEL_QUERY_TIMEOUT_MS),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { models?: { name?: string }[] };
  return (json.models ?? []).map((m) => m.name).filter((n): n is string => typeof n === "string");
}

async function queryOpenAICompatibleModels(baseUrl: string, key: string | null): Promise<string[]> {
  const headers: Record<string, string> = {};
  if (key) headers.authorization = `Bearer ${key}`;
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/models`, {
    headers,
    signal: AbortSignal.timeout(MODEL_QUERY_TIMEOUT_MS),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: { id?: string }[] };
  return (json.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string");
}

export interface ModelPreviewConfig {
  kind: AIServiceKind;
  baseUrl?: string;
  /** Ad-hoc credential typed but not yet saved (registration time, ticket 135). */
  credential?: string;
  /** Falls back to this service's saved credential when `credential` is omitted (e.g. editing with the key field left blank). */
  existingServiceId?: string;
  preferredModel?: string;
}

async function queryModelsForConfig(config: ModelPreviewConfig): Promise<string[]> {
  const preferred = config.preferredModel?.trim() || DEFAULT_MODEL_FOR_KIND[config.kind];
  let credential = config.credential?.trim() || null;
  if (!credential && config.existingServiceId) credential = await getCredential(config.existingServiceId);

  let fetched: string[] = [];
  try {
    if (config.kind === "ollama") {
      fetched = await queryOllamaModels(config.baseUrl?.trim() || "http://localhost:11434");
    } else if (config.kind === "openai-compatible" && config.baseUrl?.trim()) {
      fetched = await queryOpenAICompatibleModels(config.baseUrl.trim(), credential);
    } else {
      fetched = CURATED_MODELS[config.kind as "anthropic" | "openai"] ?? [];
    }
  } catch {
    fetched = [];
  }

  return [preferred, ...fetched.filter((m) => m !== preferred)];
}

/**
 * Models to offer in a service's model `<select>` (ticket 59). The service's
 * configured model (or kind default) always leads the list and is included
 * even when a live query fails or omits it — the picker never comes back
 * empty for a valid service.
 */
export async function listServiceModels(serviceId: string): Promise<string[]> {
  const service = await getAIService(serviceId);
  if (!service) return [];
  return queryModelsForConfig({
    kind: service.kind,
    baseUrl: service.baseUrl,
    existingServiceId: service.id,
    preferredModel: service.model,
  });
}

/**
 * Same model listing, but for a service that hasn't been saved yet (ticket
 * 135) — the registration form passes kind/base URL/credential directly
 * instead of a serviceId.
 */
export async function previewServiceModels(config: ModelPreviewConfig): Promise<string[]> {
  return queryModelsForConfig(config);
}

/** Fires a minimal completion against a service to verify it's reachable and credentialed. */
export async function testAIService(serviceId: string): Promise<{ ok: boolean; error?: string }> {
  const service = await getAIService(serviceId);
  if (!service) return { ok: false, error: "Service not found" };
  try {
    await complete(service, { system: 'Respond with exactly: {"ok":true}', user: "ping" });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
