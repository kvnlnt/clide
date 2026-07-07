import type { AIProvider, AIService, AIServiceKind } from "../../shared/types";
import { aiServicesPath, aiSettingsPath, appDataDir, ensureDir } from "../paths";
import { complete } from "./providers";
import { getLegacyCredential, saveCredential } from "./credentials";

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
