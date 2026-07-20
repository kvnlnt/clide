/**
 * Diagnostics screen (ticket 124): app/machine/workload health, gathered
 * fresh on open and refreshed on an interval only while the screen is
 * visible — zero polling cost when it's closed. Launched from Settings,
 * stacks above it (same z-tier as the profile interview takeover).
 */

import { Copy, Loader, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { copyToClipboard } from "../clipboard";
import { api } from "../rpc";
import type { AIService, DiagnosticsReport } from "../types/tasks";
import { useEscapeToClose } from "./Modal";
import { useUIFeedback } from "./UIFeedback";

interface DiagnosticsPageProps {
  onClose: () => void;
}

const REFRESH_MS = 5_000;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function reportToText(r: DiagnosticsReport): string {
  const lines = [
    `CLIDE diagnostics — ${r.generatedAt}`,
    "",
    "App",
    `  version: ${r.app.version}`,
    `  pid: ${r.app.pid}`,
    `  memory (rss): ${formatBytes(r.app.rssBytes)}`,
    `  memory (heap used): ${formatBytes(r.app.heapUsedBytes)}`,
    `  uptime: ${formatUptime(r.app.uptimeSec)}`,
    `  data dir: ${r.app.dataDir} (${formatBytes(r.app.dataDirBytes)})`,
    ...r.app.projectDbs.map((p) => `    ${p.name}: history.db ${formatBytes(p.bytes)}`),
    "",
    "Machine",
    `  ${r.machine.osType} ${r.machine.osRelease} (${r.machine.platform})`,
    `  CPU: ${r.machine.cpuModel} × ${r.machine.cpuCount}`,
    `  load average (1/5/15m): ${r.machine.loadavg.map((n) => n.toFixed(2)).join(" / ")}`,
    `  memory: ${formatBytes(r.machine.totalMemBytes - r.machine.freeMemBytes)} used / ${formatBytes(r.machine.totalMemBytes)} total`,
    `  free disk: ${r.machine.freeDiskBytes !== null ? formatBytes(r.machine.freeDiskBytes) : "unknown"}`,
    "",
    "Workload",
    `  running tasks: ${r.workload.runningTasks}`,
    `  active workflow runs: ${r.workload.activeWorkflowRuns}`,
    `  armed task schedules: ${r.workload.armedTaskSchedules}`,
    `  armed workflow schedules: ${r.workload.armedWorkflowSchedules}`,
    `  projects: ${r.workload.projectCount}`,
  ];
  return lines.join("\n");
}

/** One AI service's on-demand reachability check — never a background poller. */
function ServicePing({ service }: { service: AIService }) {
  const [state, setState] = useState<"idle" | "pinging" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const ping = async () => {
    setState("pinging");
    setError(null);
    const res = await api.testAIService(service.id);
    if (res.ok) setState("ok");
    else {
      setState("error");
      setError(res.error ?? "Unreachable");
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[13px] text-white/80">{service.name}</span>
        {service.isDefault && <span className="shrink-0 text-[10px] uppercase text-white/30">default</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {state === "ok" && <span className="text-[11px] text-green-400">Reachable</span>}
        {state === "error" && (
          <span className="max-w-[220px] truncate text-[11px] text-red-400" title={error ?? undefined}>
            {error ?? "Unreachable"}
          </span>
        )}
        <button
          onClick={() => void ping()}
          disabled={state === "pinging"}
          className="rounded-md border border-clide-border px-2 py-1 text-[11px] text-white/60 hover:bg-white/5 hover:text-white disabled:opacity-40"
        >
          {state === "pinging" ? <Loader size={11} className="animate-spin" /> : "Test"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-white/5 pt-4 first:border-t-0 first:pt-0">
      <span className="text-[12px] font-bold uppercase tracking-wider text-white/40">{title}</span>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="text-white/50">{label}</span>
      <span className="truncate text-white/80">{value}</span>
    </div>
  );
}

export default function DiagnosticsPage({ onClose }: DiagnosticsPageProps) {
  const { toast } = useUIFeedback();
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [services, setServices] = useState<AIService[]>([]);
  const [loading, setLoading] = useState(true);

  useEscapeToClose(onClose);

  const refresh = useCallback(async () => {
    const r = await api.getDiagnostics();
    setLoading(false);
    if (r) setReport(r);
  }, []);

  // Refresh on open and on an interval — only while this screen is mounted.
  useEffect(() => {
    void refresh();
    void api.listAIServices().then(setServices);
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const copyReport = async () => {
    if (!report) return;
    const ok = await copyToClipboard(reportToText(report));
    toast(ok ? "Diagnostics copied" : "Couldn't copy diagnostics", ok ? "success" : "error");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between px-[var(--clide-page-x)] pb-4 pt-[var(--clide-page-top)]">
        <div className="flex items-center gap-2">
          <h1 className="text-[20px] font-bold text-white">Diagnostics</h1>
          <button
            onClick={() => void refresh()}
            title="Refresh now"
            className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:bg-white/10 hover:text-white"
          >
            <RefreshCw size={13} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void copyReport()}
            disabled={!report}
            className="flex items-center gap-1.5 rounded-md border border-clide-border px-2.5 py-1.5 text-[12px] text-white/70 hover:bg-white/5 hover:text-white disabled:opacity-40"
          >
            <Copy size={13} /> Copy diagnostics
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="clide-scroll flex-1 overflow-y-auto px-[var(--clide-page-x)] pb-[var(--clide-page-bottom)]">
        <div className="flex w-full max-w-[820px] flex-col gap-4">
          {loading && !report ? (
            <div className="flex items-center gap-2 py-8 text-[13px] text-white/40">
              <Loader size={14} className="animate-spin" /> Gathering diagnostics…
            </div>
          ) : !report ? (
            <div className="py-8 text-[13px] text-red-300/80">Couldn't gather diagnostics.</div>
          ) : (
            <>
              <Section title="App">
                <Row label="Version" value={report.app.version} />
                <Row label="Process ID" value={String(report.app.pid)} />
                <Row label="Memory (RSS)" value={formatBytes(report.app.rssBytes)} />
                <Row label="Memory (heap used)" value={formatBytes(report.app.heapUsedBytes)} />
                <Row label="Uptime" value={formatUptime(report.app.uptimeSec)} />
                <Row label="Data directory" value={report.app.dataDir} />
                <Row label="Data directory size" value={formatBytes(report.app.dataDirBytes)} />
                {report.app.projectDbs.length > 0 && (
                  <div className="mt-1 flex flex-col gap-1 rounded-md bg-white/[0.02] px-3 py-2">
                    {report.app.projectDbs.map((p) => (
                      <Row key={p.name} label={`history.db — ${p.name}`} value={formatBytes(p.bytes)} />
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Machine">
                <Row label="OS" value={`${report.machine.osType} ${report.machine.osRelease}`} />
                <Row label="CPU" value={`${report.machine.cpuModel} × ${report.machine.cpuCount}`} />
                <Row label="Load average (1/5/15m)" value={report.machine.loadavg.map((n) => n.toFixed(2)).join(" / ")} />
                <Row
                  label="Memory"
                  value={`${formatBytes(report.machine.totalMemBytes - report.machine.freeMemBytes)} used / ${formatBytes(report.machine.totalMemBytes)} total`}
                />
                <Row
                  label="Free disk"
                  value={report.machine.freeDiskBytes !== null ? formatBytes(report.machine.freeDiskBytes) : "Unknown"}
                />
              </Section>

              <Section title="Workload">
                <Row label="Running tasks" value={String(report.workload.runningTasks)} />
                <Row label="Active workflow runs" value={String(report.workload.activeWorkflowRuns)} />
                <Row label="Armed task schedules" value={String(report.workload.armedTaskSchedules)} />
                <Row label="Armed workflow schedules" value={String(report.workload.armedWorkflowSchedules)} />
                <Row label="Projects" value={String(report.workload.projectCount)} />
              </Section>

              <Section title="AI services">
                {services.length === 0 ? (
                  <span className="text-[13px] text-white/40">No AI services configured.</span>
                ) : (
                  <div className="flex flex-col divide-y divide-white/5">
                    {services.map((s) => (
                      <ServicePing key={s.id} service={s} />
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
