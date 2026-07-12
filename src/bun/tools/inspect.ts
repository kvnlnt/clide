import { realpathSync, statSync } from "node:fs";

const HELP_TIMEOUT_MS = 4000;
const MAX_HELP_CHARS = 64 * 1024;
/** Below this, an attempt's output is treated as noise ("no help", not real docs). */
const MIN_SUBSTANTIVE_CHARS = 20;

export interface ResolveResult {
  ok: boolean;
  execPath?: string;
  error?: string;
}

/** Resolves a bare executable name (PATH lookup) or explicit path to a real, absolute path. */
export function resolveTool(nameOrPath: string): ResolveResult {
  if (nameOrPath.includes("/")) {
    try {
      return { ok: true, execPath: realpathSync(nameOrPath) };
    } catch {
      return { ok: false, error: `Not found: ${nameOrPath}` };
    }
  }
  const found = Bun.which(nameOrPath);
  if (!found) return { ok: false, error: `"${nameOrPath}" is not on PATH` };
  return { ok: true, execPath: found };
}

interface CaptureResult {
  text: string;
  exitCode: number | null;
}

/**
 * Spawns `argv` with a hard timeout and closed stdin, capturing stdout+stderr
 * (many tools print help to stderr). Never a shell string — argv array only.
 * Safety rails for probing arbitrary/unverified executables (ticket 53/55).
 */
async function runCapture(argv: string[]): Promise<CaptureResult | null> {
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
  } catch {
    return null;
  }
  const timer = setTimeout(() => {
    try {
      proc.kill();
    } catch {
      /* already exited */
    }
  }, HELP_TIMEOUT_MS);

  try {
    const decoder = new TextDecoder();
    const [outBytes, errBytes] = await Promise.all([
      new Response(proc.stdout as ReadableStream<Uint8Array>).arrayBuffer(),
      new Response(proc.stderr as ReadableStream<Uint8Array>).arrayBuffer(),
    ]);
    const exitCode = await proc.exited;
    const out = decoder.decode(outBytes).slice(0, MAX_HELP_CHARS);
    const err = decoder.decode(errBytes).slice(0, MAX_HELP_CHARS);
    const text = [out, err].filter((s) => s.trim()).join("\n");
    return { text: text.slice(0, MAX_HELP_CHARS), exitCode };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface HelpCapture {
  text: string;
  /** Which probe produced it, for diagnostics. */
  source: "--help" | "-h" | "help" | "man";
}

/**
 * Tries `--help`, `-h`, `help`, then `man <name>`, keeping the first
 * substantive output — a non-zero exit is normal and not a failure signal.
 * Executing the binary is the caller's responsibility to gate on consent.
 */
export async function captureHelp(execPath: string): Promise<HelpCapture | null> {
  const attempts: { argv: string[]; source: HelpCapture["source"] }[] = [
    { argv: [execPath, "--help"], source: "--help" },
    { argv: [execPath, "-h"], source: "-h" },
    { argv: [execPath, "help"], source: "help" },
  ];
  for (const attempt of attempts) {
    const result = await runCapture(attempt.argv);
    if (result && result.text.trim().length >= MIN_SUBSTANTIVE_CHARS) {
      return { text: result.text.trim(), source: attempt.source };
    }
  }

  const name = execPath.split("/").pop() ?? execPath;
  const man = await runCapture(["man", name]);
  if (man && man.text.trim().length >= MIN_SUBSTANTIVE_CHARS) {
    // Best-effort strip of overstrike bold/underline sequences some man
    // implementations still emit even when stdout isn't a TTY.
    const cleaned = man.text.replace(/.\x08/g, "");
    return { text: cleaned.trim(), source: "man" };
  }

  return null;
}

/**
 * Version fingerprint for cache invalidation (ticket 60): the first line of
 * `--version` when the tool has one (same safety rails as help capture),
 * else the binary's size+mtime. Pass `allowExec: false` when the user has
 * never consented to executing this binary — the stat-based fingerprint is
 * used alone then. Never throws; a fingerprint of last resort is always
 * produced so freshness checks can't block.
 */
export async function captureFingerprint(execPath: string, allowExec = true): Promise<string> {
  if (allowExec) {
    const result = await runCapture([execPath, "--version"]);
    const firstLine = result?.text.split("\n")[0]?.trim();
    if (firstLine && firstLine.length > 0 && firstLine.length <= 200) {
      return `v:${firstLine}`;
    }
  }
  try {
    const st = statSync(execPath);
    return `f:${st.size}-${st.mtimeMs}`;
  } catch {
    return "f:unknown";
  }
}
