import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { appDataDir, ensureDir } from "../paths";

export interface PackageManagerAdapter {
  id: string;
  name: string;
  detect(): Promise<{ ok: boolean; path?: string; version?: string }>;
  // search, info, install, resolveBinaries are manager-specific; the
  // implementations here may be simple wrappers returning empty results.
  search(query: string): Promise<{ ok: boolean; results: any[] }>;
  install(pkg: string, onChunk: (s: string) => void): Promise<{ ok: boolean; error?: string }>;
  resolveBinaries(pkg: string): Promise<{ ok: boolean; binaries: { name: string; path: string }[]; error?: string }>;
}

const CACHE_PATH = join(appDataDir(), "package-managers.json");

function readCache(): any[] {
  try {
    if (!existsSync(CACHE_PATH)) return [];
    const raw = readFileSync(CACHE_PATH, "utf-8");
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

function writeCache(cfg: any[]): void {
  try {
    ensureDir(appDataDir());
    writeFileSync(CACHE_PATH, JSON.stringify(cfg, null, 2));
  } catch {
    // best-effort
  }
}

async function probeVersion(bin: string): Promise<string | undefined> {
  try {
    const p = Bun.spawn([bin, "--version"], { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
    const [outBytes] = await Promise.all([
      new Response(p.stdout as ReadableStream<Uint8Array>).arrayBuffer(),
      p.exited,
    ]);
    const txt = new TextDecoder().decode(outBytes || new ArrayBuffer(0));
    const first = txt.split("\n")[0]?.trim();
    return first || undefined;
  } catch {
    return undefined;
  }
}

// Helper to stream stdout/stderr from Bun.spawn to onChunk
function streamProcess(proc: any, onChunk: (s: string) => void) {
  const decoder = new TextDecoder();
  if (proc.stdout) {
    void new Response(proc.stdout as ReadableStream<Uint8Array>).arrayBuffer().then((buf) => {
      try {
        onChunk(decoder.decode(buf));
      } catch {}
    });
  }
  if (proc.stderr) {
    void new Response(proc.stderr as ReadableStream<Uint8Array>).arrayBuffer().then((buf) => {
      try {
        onChunk(decoder.decode(buf));
      } catch {}
    });
  }
}

const builtinAdapters: PackageManagerAdapter[] = [
  {
    id: "homebrew",
    name: "Homebrew",
    async detect() {
      const bin = Bun.which("brew");
      if (!bin) return { ok: false };
      const v = await probeVersion(bin);
      return { ok: true, path: bin, version: v };
    },
    async search(query) {
      try {
        const p = Bun.spawn(["brew", "info", "--json=v2", query], { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
        const [out] = await Promise.all([new Response(p.stdout as ReadableStream<Uint8Array>).arrayBuffer(), p.exited]);
        const txt = new TextDecoder().decode(out || new ArrayBuffer(0));
        try {
          const parsed = JSON.parse(txt);
          const formulas = parsed?.formulae ?? parsed?.casks ?? [];
          const results = (formulas || []).map((f: any) => ({
            name: f.name,
            desc: f.desc || "",
            homepage: f.homepage,
            version: f.versions?.stable,
          }));
          return { ok: true, results };
        } catch {
          const p2 = Bun.spawn(["brew", "search", "--formula", query], {
            stdout: "pipe",
            stderr: "pipe",
            stdin: "ignore",
          });
          const [out2] = await Promise.all([
            new Response(p2.stdout as ReadableStream<Uint8Array>).arrayBuffer(),
            p2.exited,
          ]);
          const txt2 = new TextDecoder().decode(out2 || new ArrayBuffer(0));
          const names = txt2.split(/\s+/).filter(Boolean);
          const results = names.map((n) => ({ name: n, desc: "", homepage: undefined }));
          return { ok: true, results };
        }
      } catch {
        return { ok: false, results: [] };
      }
    },
    async install(pkg, onChunk) {
      const env = { HOMEBREW_NO_AUTO_UPDATE: "1" } as any;
      try {
        const p = Bun.spawn(["brew", "install", pkg], { stdout: "pipe", stderr: "pipe", stdin: "ignore", env });
        streamProcess(p, onChunk);
        await p.exited;
        return { ok: true };
      } catch (err: any) {
        const msg = String(err?.message || err);
        onChunk(msg + "\n");
        return { ok: false, error: msg };
      }
    },
    async resolveBinaries(pkg) {
      try {
        const p = Bun.spawn(["brew", "--prefix"], { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
        const [out] = await Promise.all([new Response(p.stdout as ReadableStream<Uint8Array>).arrayBuffer(), p.exited]);
        const prefix = new TextDecoder().decode(out || new ArrayBuffer(0)).trim() || "/usr/local";
        const p2 = Bun.spawn(["brew", "list", pkg], { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
        const [out2] = await Promise.all([
          new Response(p2.stdout as ReadableStream<Uint8Array>).arrayBuffer(),
          p2.exited,
        ]);
        const txt = new TextDecoder().decode(out2 || new ArrayBuffer(0));
        const lines = txt
          .split(/\n+/)
          .map((l) => l.trim())
          .filter(Boolean);
        const bins: { name: string; path: string }[] = [];
        for (const l of lines) {
          if (l.includes(`${prefix}/bin/`) || l.includes(`/bin/`)) {
            const name = l.split("/").pop()!;
            bins.push({ name, path: l });
          }
        }
        if (bins.length === 0) {
          const candidates = [
            `${prefix}/bin/${pkg}`,
            `${prefix}/opt/${pkg}/bin/${pkg}`,
            `/opt/homebrew/bin/${pkg}`,
            `/usr/local/bin/${pkg}`,
          ];
          for (const c of candidates) if (existsSync(c)) bins.push({ name: pkg, path: c });
        }
        return { ok: true, binaries: bins };
      } catch (err) {
        return { ok: false, binaries: [], error: String(err) };
      }
    },
  },
  {
    id: "npm",
    name: "npm/bun (global)",
    async detect() {
      const bin = Bun.which("bun") || Bun.which("npm") || Bun.which("node");
      if (!bin) return { ok: false };
      const v = await probeVersion(bin);
      return { ok: true, path: bin, version: v };
    },
    async search(query) {
      try {
        const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=20`;
        const res = await fetch(url);
        if (!res.ok) return { ok: false, results: [] };
        const j = await res.json();
        const results = (j.objects || []).map((o: any) => ({
          name: o.package.name,
          desc: o.package.description,
          homepage: o.package.links?.homepage || o.package.links?.npm,
          version: o.package.version,
        }));
        return { ok: true, results };
      } catch {
        return { ok: false, results: [] };
      }
    },
    async install(pkg, onChunk) {
      const runner = Bun.which("bun") ? "bun" : Bun.which("npm") ? "npm" : null;
      if (!runner) return { ok: false, error: "npm/bun not found" };
      try {
        if (runner === "bun") {
          const p = Bun.spawn(["bun", "add", "-g", pkg], { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
          streamProcess(p, onChunk);
          await p.exited;
        } else {
          const p = Bun.spawn(["npm", "install", "-g", "--yes", pkg], {
            stdout: "pipe",
            stderr: "pipe",
            stdin: "ignore",
          });
          streamProcess(p, onChunk);
          await p.exited;
        }
        return { ok: true };
      } catch (err: any) {
        onChunk(String(err?.message || err) + "\n");
        return { ok: false, error: String(err) };
      }
    },
    async resolveBinaries(pkg) {
      try {
        const runner = Bun.which("bun") ? "bun" : Bun.which("npm") ? "npm" : null;
        let root = null;
        if (runner === "npm") {
          const p = Bun.spawn(["npm", "root", "-g"], { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
          const [out] = await Promise.all([
            new Response(p.stdout as ReadableStream<Uint8Array>).arrayBuffer(),
            p.exited,
          ]);
          root = new TextDecoder().decode(out || new ArrayBuffer(0)).trim();
        } else if (runner === "bun") {
          const p = Bun.spawn(["bun", "config", "global-dir"], { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
          try {
            const [out] = await Promise.all([
              new Response(p.stdout as ReadableStream<Uint8Array>).arrayBuffer(),
              p.exited,
            ]);
            root = new TextDecoder().decode(out || new ArrayBuffer(0)).trim();
          } catch {
            root = null;
          }
        }
        const bins: { name: string; path: string }[] = [];
        if (root) {
          const pkgPath = join(root, pkg);
          if (existsSync(pkgPath)) {
            const pkgJson = join(pkgPath, "package.json");
            if (existsSync(pkgJson)) {
              const pj = JSON.parse(readFileSync(pkgJson, "utf-8") || "{}");
              const binField = pj.bin;
              if (typeof binField === "string") {
                const pth = join(pkgPath, binField);
                if (existsSync(pth)) bins.push({ name: pkg, path: pth });
              } else if (typeof binField === "object") {
                for (const [k, v] of Object.entries(binField)) {
                  const pth = join(pkgPath, v as string);
                  if (existsSync(pth)) bins.push({ name: k, path: pth });
                }
              }
            }
          }
        }
        const common = [
          "/usr/local/bin",
          "/opt/homebrew/bin",
          join(process.env.HOME || "~", ".bun", "bin"),
          join(process.env.HOME || "~", ".nvm", "bin"),
        ];
        for (const dir of common) {
          try {
            const cand = join(dir, pkg);
            if (existsSync(cand)) bins.push({ name: pkg, path: cand });
          } catch {}
        }
        return { ok: true, binaries: bins };
      } catch (err) {
        return { ok: false, binaries: [], error: String(err) };
      }
    },
  },
  {
    id: "pipx",
    name: "pipx/pip (python)",
    async detect() {
      const bin = Bun.which("pipx") || Bun.which("pip") || Bun.which("python3") || Bun.which("python");
      if (!bin) return { ok: false };
      const v = await probeVersion(bin);
      return { ok: true, path: bin, version: v };
    },
    async search(query) {
      try {
        const url = `https://pypi.org/pypi/${encodeURIComponent(query)}/json`;
        const res = await fetch(url);
        if (!res.ok) return { ok: true, results: [] };
        const j = await res.json();
        const info = j.info || {};
        return {
          ok: true,
          results: [
            { name: info.name || query, desc: info.summary || "", homepage: info.home_page || info.project_url },
          ],
        };
      } catch {
        return { ok: false, results: [] };
      }
    },
    async install(pkg, onChunk) {
      const runner = Bun.which("pipx") ? "pipx" : Bun.which("pip") ? "pip" : null;
      if (!runner) return { ok: false, error: "pipx/pip not found" };
      try {
        if (runner === "pipx") {
          const p = Bun.spawn(["pipx", "install", pkg], { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
          streamProcess(p, onChunk);
          await p.exited;
        } else {
          const p = Bun.spawn(["pip", "install", "--user", pkg], { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
          streamProcess(p, onChunk);
          await p.exited;
        }
        return { ok: true };
      } catch (err: any) {
        onChunk(String(err?.message || err) + "\n");
        return { ok: false, error: String(err) };
      }
    },
    async resolveBinaries(pkg) {
      try {
        const bins: { name: string; path: string }[] = [];
        if (Bun.which("pipx")) {
          const p = Bun.spawn(["pipx", "list", "--json"], { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
          const [out] = await Promise.all([
            new Response(p.stdout as ReadableStream<Uint8Array>).arrayBuffer(),
            p.exited,
          ]);
          const j = JSON.parse(new TextDecoder().decode(out || new ArrayBuffer(0)) || "{}");
          for (const name of Object.keys(j?.venvs ?? {})) {
            if (name === pkg) {
              const v = j.venvs[name];
              const binDir = v?.bin_path || (v?.venv_path && join(v.venv_path, "bin"));
              if (binDir && existsSync(binDir)) {
                for (const f of readdirSync(binDir)) {
                  const pth = join(binDir, f);
                  try {
                    if (statSync(pth).isFile()) bins.push({ name: f, path: pth });
                  } catch {}
                }
              }
            }
          }
        }
        const userBin = join(process.env.HOME || "~", ".local", "bin");
        if (existsSync(userBin)) {
          for (const f of readdirSync(userBin)) {
            if (f.includes(pkg)) {
              const pth = join(userBin, f);
              bins.push({ name: f, path: pth });
            }
          }
        }
        return { ok: true, binaries: bins };
      } catch (err) {
        return { ok: false, binaries: [], error: String(err) };
      }
    },
  },
  {
    id: "cargo",
    name: "cargo",
    async detect() {
      const bin = Bun.which("cargo");
      if (!bin) return { ok: false };
      const v = await probeVersion(bin);
      return { ok: true, path: bin, version: v };
    },
    async search(query) {
      try {
        const p = Bun.spawn(["cargo", "search", query, "--limit", "10"], {
          stdout: "pipe",
          stderr: "pipe",
          stdin: "ignore",
        });
        const [out] = await Promise.all([new Response(p.stdout as ReadableStream<Uint8Array>).arrayBuffer(), p.exited]);
        const txt = new TextDecoder().decode(out || new ArrayBuffer(0));
        const lines = txt.split(/\n+/).filter(Boolean);
        const results = lines.map((l) => {
          const m = /^([^\s=]+) = "(.*)"/.exec(l);
          if (m) return { name: m[1], desc: m[2] };
          return { name: l.split(" ")[0], desc: "" };
        });
        return { ok: true, results };
      } catch {
        return { ok: false, results: [] };
      }
    },
    async install(pkg, onChunk) {
      try {
        const cargoBin = join(process.env.HOME || "~", ".cargo", "bin");
        const before = existsSync(cargoBin) ? readdirSync(cargoBin) : [];
        const p = Bun.spawn(["cargo", "install", pkg], { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
        streamProcess(p, onChunk);
        await p.exited;
        const after = existsSync(cargoBin) ? readdirSync(cargoBin) : [];
        const added = after.filter((n) => !before.includes(n));
        if (added.length === 0) {
          onChunk("cargo: no new binaries detected after install\n");
        }
        return { ok: true };
      } catch (err: any) {
        onChunk(String(err?.message || err) + "\n");
        return { ok: false, error: String(err) };
      }
    },
    async resolveBinaries(pkg) {
      try {
        const cargoBin = join(process.env.HOME || "~", ".cargo", "bin");
        const bins: { name: string; path: string }[] = [];
        if (existsSync(cargoBin)) {
          for (const f of readdirSync(cargoBin)) {
            if (f.includes(pkg) || f === pkg) bins.push({ name: f, path: join(cargoBin, f) });
          }
        }
        return { ok: true, binaries: bins };
      } catch (err) {
        return { ok: false, binaries: [], error: String(err) };
      }
    },
  },
];

export async function listPackageManagers(): Promise<any[]> {
  const cached = readCache();
  // Merge cache with builtin adapters: ensure each builtin exists in cache
  const byId = new Map<string, any>();
  for (const c of cached) byId.set(c.id, c);
  for (const a of builtinAdapters) {
    if (!byId.has(a.id)) {
      byId.set(a.id, { id: a.id, name: a.name, enabled: true, custom: false });
    }
  }
  return Array.from(byId.values());
}

export async function detectPackageManagers(): Promise<any[]> {
  const out: any[] = [];
  for (const a of builtinAdapters) {
    const r = await a.detect();
    out.push({
      id: a.id,
      name: a.name,
      path: r.path,
      version: r.version,
      enabled: true,
      custom: false,
      detectedAt: new Date().toISOString(),
    });
  }
  writeCache(out);
  return out;
}

export async function addCustomPackageManager(id: string, name: string, path: string, enabled = true): Promise<any> {
  const cfg = readCache();
  const next = cfg
    .filter((c) => c.id !== id)
    .concat([{ id, name, path, enabled, custom: true, detectedAt: new Date().toISOString() }]);
  writeCache(next);
  return next.find((c) => c.id === id);
}

export async function removeCustomPackageManager(id: string): Promise<void> {
  const cfg = readCache().filter((c) => c.id !== id);
  writeCache(cfg);
}

export async function savePackageManagersOrder(list: any[]): Promise<void> {
  writeCache(list);
}

/** Builtin adapters that are currently enabled, in the user's preferred order (list order == preference). */
async function getOrderedEnabledAdapters(): Promise<PackageManagerAdapter[]> {
  const cfg = await listPackageManagers();
  const adapterById = new Map(builtinAdapters.map((a) => [a.id, a]));
  return cfg
    .filter((c) => c.enabled !== false)
    .map((c) => adapterById.get(c.id))
    .filter((a): a is PackageManagerAdapter => !!a);
}

export async function searchPackageManagers(_query: string): Promise<{ ok: boolean; results: any[] }> {
  const results: any[] = [];
  const q = (_query || "").trim();
  if (!q) return { ok: true, results: [] };
  const enabledAdapters = await getOrderedEnabledAdapters();
  const promises = enabledAdapters.map(async (a) => {
    try {
      const r = await a.search(q);
      return { id: a.id, name: a.name, ok: r.ok, results: r.results };
    } catch (err) {
      return { id: a.id, name: a.name, ok: false, results: [] };
    }
  });
  const settled = await Promise.allSettled(promises);
  for (const s of settled) {
    if (s.status === "fulfilled") results.push(s.value);
  }
  return { ok: true, results };
}

let installLock = false;
const installQueue: Array<() => void> = [];

async function withInstallLock<T>(fn: () => Promise<T>) {
  if (installLock) {
    await new Promise<void>((res) => installQueue.push(res));
  }
  installLock = true;
  try {
    return await fn();
  } finally {
    installLock = false;
    const next = installQueue.shift();
    if (next) next();
  }
}

export async function installPackage(
  managerId: string,
  packageName: string,
  onChunk: (s: string) => void,
): Promise<{ ok: boolean; installId?: string; error?: string }> {
  const adapter = builtinAdapters.find((a) => a.id === managerId);
  if (!adapter) {
    onChunk(`Unknown package manager: ${managerId}\n`);
    return { ok: false, error: "Unknown manager" };
  }
  const enabledAdapters = await getOrderedEnabledAdapters();
  if (!enabledAdapters.some((a) => a.id === managerId)) {
    onChunk(`${adapter.name} is disabled\n`);
    return { ok: false, error: "Package manager is disabled" };
  }
  return await withInstallLock(async () => {
    try {
      onChunk(`Installing ${packageName} with ${adapter.name}\n`);
      const res = await adapter.install(packageName, onChunk);
      if (!res.ok) return { ok: false, error: res.error };
      onChunk(`Install finished for ${packageName}\n`);
      return { ok: true };
    } catch (err: any) {
      const msg = String(err?.message || err);
      onChunk(msg + "\n");
      return { ok: false, error: msg };
    }
  });
}

export async function resolvePackageBinaries(
  managerId: string,
  packageName: string,
): Promise<{ ok: boolean; binaries?: { name: string; path: string }[]; error?: string }> {
  const adapter = builtinAdapters.find((a) => a.id === managerId);
  if (!adapter) return { ok: false, binaries: [], error: "Unknown manager" };
  try {
    return await adapter.resolveBinaries(packageName);
  } catch (err) {
    return { ok: false, binaries: [], error: String(err) };
  }
}

export default {
  listPackageManagers,
  detectPackageManagers,
  addCustomPackageManager,
  removeCustomPackageManager,
  searchPackageManagers,
  installPackage,
  resolvePackageBinaries,
};
