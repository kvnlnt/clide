/**
 * Diagnostics (ticket 124): a point-in-time snapshot of app/machine/workload
 * health, gathered fresh on every request — nothing here runs on an interval
 * or costs anything while the Diagnostics screen is closed.
 */

import { readdirSync, statSync } from "node:fs";
import { cpus, freemem, loadavg, platform, release, totalmem, type as osType } from "node:os";
import { join } from "node:path";
import type { DiagnosticsReport } from "../shared/types";
import { listProjects } from "./config";
import { appDataDir } from "./paths";
import { runningCount } from "./runner/registry";
import { armedTimerCount } from "./scheduler";
import { activeWorkflowRunCount } from "./workflows/engine";
import { armedWorkflowTimerCount } from "./workflows/schedules";

const MAX_WALK_ENTRIES = 20_000; // Bound the data-dir size walk — never a slow diagnostics click.

/** Best-effort recursive directory size, bounded so a huge data dir can't stall the UI. */
function dirSizeBytes(dir: string): number {
  let total = 0;
  let visited = 0;
  const walk = (d: string) => {
    if (visited >= MAX_WALK_ENTRIES) return;
    let entries: string[];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const name of entries) {
      if (visited++ >= MAX_WALK_ENTRIES) return;
      const full = join(d, name);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) walk(full);
        else total += stat.size;
      } catch {
        /* skip unreadable entries */
      }
    }
  };
  walk(dir);
  return total;
}

function fileSizeBytes(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

/** `df -k <path>` free bytes on the volume holding the app data dir — no portable Node/Bun API for this. */
async function freeDiskBytes(path: string): Promise<number | null> {
  try {
    const proc = Bun.spawn(["df", "-k", path], { stdout: "pipe" });
    const out = await new Response(proc.stdout).text();
    const lines = out.trim().split("\n");
    const fields = lines[lines.length - 1]?.trim().split(/\s+/);
    const availKb = fields ? Number(fields[3]) : NaN;
    return Number.isFinite(availKb) ? availKb * 1024 : null;
  } catch {
    return null;
  }
}

async function appVersion(): Promise<string> {
  try {
    const pkgPath = join(import.meta.dir, "../../package.json");
    const pkg = JSON.parse(await Bun.file(pkgPath).text()) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

export async function gatherDiagnostics(): Promise<DiagnosticsReport> {
  const dataDir = appDataDir();
  const mem = process.memoryUsage();
  const projects = await listProjects();

  const projectDbs = projects.map((p) => ({
    name: p.name,
    bytes: fileSizeBytes(join(p.path, "history.db")),
  }));

  const cpuList = cpus();

  return {
    generatedAt: new Date().toISOString(),
    app: {
      pid: process.pid,
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
      uptimeSec: process.uptime(),
      version: await appVersion(),
      dataDir,
      dataDirBytes: dirSizeBytes(dataDir),
      projectDbs,
    },
    machine: {
      platform: platform(),
      osType: osType(),
      osRelease: release(),
      cpuModel: cpuList[0]?.model ?? "unknown",
      cpuCount: cpuList.length,
      loadavg: loadavg(),
      totalMemBytes: totalmem(),
      freeMemBytes: freemem(),
      freeDiskBytes: await freeDiskBytes(dataDir),
    },
    workload: {
      runningTasks: runningCount(),
      activeWorkflowRuns: activeWorkflowRunCount(),
      armedTaskSchedules: armedTimerCount(),
      armedWorkflowSchedules: armedWorkflowTimerCount(),
      projectCount: projects.length,
    },
  };
}
