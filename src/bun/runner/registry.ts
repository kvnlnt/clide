import type { Subprocess } from "bun";

/** In-memory map of currently-running processes, keyed by run id. */
const runningProcesses = new Map<string, Subprocess>();

export function isRunning(runId: string): boolean {
  return runningProcesses.has(runId);
}

export function register(runId: string, proc: Subprocess): void {
  runningProcesses.set(runId, proc);
}

export function unregister(runId: string): void {
  runningProcesses.delete(runId);
}

export function get(runId: string): Subprocess | undefined {
  return runningProcesses.get(runId);
}

export function killAll(): void {
  for (const proc of runningProcesses.values()) {
    try {
      proc.kill();
    } catch {
      /* ignore */
    }
  }
  runningProcesses.clear();
}
