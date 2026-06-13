import type { AIProvider } from "../../shared/types";

/**
 * Secure credential storage backed by the macOS keychain via the `security`
 * CLI. Keys are stored as generic passwords scoped to a per-app service name so
 * they never touch plain-text files.
 */

const SERVICE = "dev.clide.ai";

function account(provider: AIProvider): string {
  return `clide-${provider}`;
}

export async function saveCredential(provider: AIProvider, key: string): Promise<void> {
  if (process.platform !== "darwin") {
    // Fallback for non-macOS dev environments: in-memory only.
    memoryStore.set(provider, key);
    return;
  }
  // -U updates if it already exists.
  const proc = Bun.spawn(
    ["security", "add-generic-password", "-U", "-s", SERVICE, "-a", account(provider), "-w", key],
    { stdout: "ignore", stderr: "ignore" },
  );
  await proc.exited;
}

export async function getCredential(provider: AIProvider): Promise<string | null> {
  if (process.platform !== "darwin") {
    return memoryStore.get(provider) ?? null;
  }
  const proc = Bun.spawn(["security", "find-generic-password", "-s", SERVICE, "-a", account(provider), "-w"], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) return null;
  const out = (await new Response(proc.stdout).text()).trim();
  return out.length > 0 ? out : null;
}

export async function hasCredential(provider: AIProvider): Promise<boolean> {
  // Ollama runs locally and needs no API key.
  if (provider === "ollama") return true;
  return (await getCredential(provider)) !== null;
}

const memoryStore = new Map<AIProvider, string>();
