import type { AIProvider } from "../../shared/types";

/**
 * Secure credential storage backed by the macOS keychain via the `security`
 * CLI. Keys are stored as generic passwords scoped to a per-app service name so
 * they never touch plain-text files. Keyed by AI service id (ticket 45) — any
 * string, not a fixed provider union.
 */

const SERVICE = "dev.clide.ai";

function account(serviceId: string): string {
  return `clide-${serviceId}`;
}

async function keychainSet(acct: string, key: string): Promise<void> {
  if (process.platform !== "darwin") {
    memoryStore.set(acct, key);
    return;
  }
  // -U updates if it already exists.
  const proc = Bun.spawn(["security", "add-generic-password", "-U", "-s", SERVICE, "-a", acct, "-w", key], {
    stdout: "ignore",
    stderr: "ignore",
  });
  await proc.exited;
}

async function keychainGet(acct: string): Promise<string | null> {
  if (process.platform !== "darwin") {
    return memoryStore.get(acct) ?? null;
  }
  const proc = Bun.spawn(["security", "find-generic-password", "-s", SERVICE, "-a", acct, "-w"], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) return null;
  const out = (await new Response(proc.stdout).text()).trim();
  return out.length > 0 ? out : null;
}

export async function saveCredential(serviceId: string, key: string): Promise<void> {
  await keychainSet(account(serviceId), key);
}

export async function getCredential(serviceId: string): Promise<string | null> {
  return keychainGet(account(serviceId));
}

export async function hasCredential(serviceId: string): Promise<boolean> {
  return (await getCredential(serviceId)) !== null;
}

/** Legacy provider-keyed keychain entries from before ticket 45 — read once during migration. */
export async function getLegacyCredential(provider: AIProvider): Promise<string | null> {
  return keychainGet(`clide-${provider}`);
}

const memoryStore = new Map<string, string>();
