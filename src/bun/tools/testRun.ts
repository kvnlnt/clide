const TEST_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_CHARS = 256 * 1024;

const activeRuns = new Map<string, ReturnType<typeof Bun.spawn>>();

/**
 * Minimal POSIX-ish word split (quotes + backslash-escapes) so the modal's
 * single arg-string field becomes an argv array — never a shell string, so
 * there's no pipe/redirect/glob/injection surface (same rail as ticket 53's
 * help capture).
 */
export function parseArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let hasToken = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (inSingle) {
      if (ch === "'") inSingle = false;
      else current += ch;
      continue;
    }
    if (inDouble) {
      if (ch === '"') inDouble = false;
      else if (ch === "\\" && i + 1 < input.length && (input[i + 1] === '"' || input[i + 1] === "\\")) {
        current += input[++i];
      } else current += ch;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      hasToken = true;
    } else if (ch === '"') {
      inDouble = true;
      hasToken = true;
    } else if (ch === "\\" && i + 1 < input.length) {
      current += input[++i];
      hasToken = true;
    } else if (/\s/.test(ch)) {
      if (hasToken) {
        args.push(current);
        current = "";
        hasToken = false;
      }
    } else {
      current += ch;
      hasToken = true;
    }
  }
  if (hasToken) args.push(current);
  return args;
}

/** Kills the process backing `runId`, if still running. Returns whether one was found. */
export function cancelToolTest(runId: string): boolean {
  const proc = activeRuns.get(runId);
  if (!proc) return false;
  try {
    proc.kill();
  } catch {
    /* already exited */
  }
  return true;
}

/**
 * Spawns `execPath` with `args` (argv array, no shell) and streams
 * stdout/stderr chunk-by-chunk as they arrive — the REPL feel depends on
 * output appearing live, not buffered until exit. A hard timeout and a
 * total-output cap guard against a hung or runaway tool wedging the modal;
 * both kill the process tree rather than merely stop reading it.
 */
export async function runToolTest(
  runId: string,
  execPath: string,
  args: string[],
  onChunk: (type: "stdout" | "stderr", data: string) => void,
  onExit: (exitCode: number | null, timedOut: boolean, truncated: boolean) => void,
): Promise<void> {
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn([execPath, ...args], { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
  } catch (err) {
    onChunk("stderr", `Failed to start: ${String(err)}`);
    onExit(null, false, false);
    return;
  }
  activeRuns.set(runId, proc);

  let timedOut = false;
  let truncated = false;
  let totalChars = 0;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      proc.kill();
    } catch {
      /* already exited */
    }
  }, TEST_TIMEOUT_MS);

  const pump = async (stream: ReadableStream<Uint8Array>, type: "stdout" | "stderr") => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (truncated) continue; // keep draining so the child doesn't block on a full pipe
        const text = decoder.decode(value, { stream: true });
        const remaining = MAX_OUTPUT_CHARS - totalChars;
        if (remaining <= 0) {
          truncated = true;
          onChunk(type, "\n[output truncated — limit reached]\n");
          try {
            proc.kill();
          } catch {
            /* already exited */
          }
          continue;
        }
        totalChars += text.length;
        onChunk(type, text.length > remaining ? text.slice(0, remaining) : text);
        if (text.length > remaining) {
          truncated = true;
          onChunk(type, "\n[output truncated — limit reached]\n");
          try {
            proc.kill();
          } catch {
            /* already exited */
          }
        }
      }
    } catch {
      /* stream aborted by kill() — fall through to exit handling */
    }
  };

  await Promise.all([
    pump(proc.stdout as ReadableStream<Uint8Array>, "stdout"),
    pump(proc.stderr as ReadableStream<Uint8Array>, "stderr"),
  ]);
  const exitCode = await proc.exited;
  clearTimeout(timer);
  activeRuns.delete(runId);
  onExit(exitCode, timedOut, truncated);
}
