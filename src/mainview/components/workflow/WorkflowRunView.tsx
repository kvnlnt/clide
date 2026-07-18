import { ArrowLeft, ChevronDown, ChevronRight, CircleSlash, RotateCw, Square, Terminal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import { api, on } from "../../rpc";
import type { RunStatus, WorkflowPlanEntry, WorkflowRun, WorkflowStepRecord } from "../../types/forms";
import AutoSizeOutput from "../output/AutoSizeOutput";
import StatusIcon from "../statusIcon";
import { useUIFeedback } from "../UIFeedback";

/** Workflow step statuses map onto the card status visual language (ticket 40). */
const STATUS_AS_RUN: Record<WorkflowStepRecord["status"], RunStatus | null> = {
  pending: "pending",
  running: "running",
  succeeded: "success",
  failed: "error",
  skipped: null,
};

function formatDuration(ms?: number): string {
  if (ms === undefined) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function triggerLabel(run: WorkflowRun): string {
  const t = run.trigger;
  if (t.type === "manual") return "manual";
  if (t.type === "schedule") return `schedule ${t.detail ?? ""}`.trim();
  return `on ${t.detail ?? "form"}`;
}

// ---------------------------------------------------------------------------
// One CI-style trace row (ticket 85), with the replay slot (ticket 86).
// ---------------------------------------------------------------------------

function StepTraceRow({
  record,
  onReplay,
  replayResult,
  replaying,
}: {
  record: WorkflowStepRecord;
  onReplay?: () => void;
  replayResult?: WorkflowStepRecord;
  replaying?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const skipped = record.status === "skipped";
  const mapped = STATUS_AS_RUN[record.status];

  return (
    <div className={skipped ? "opacity-50" : ""}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-white/[0.03]"
        style={{ paddingLeft: 8 + record.depth * 18 }}
      >
        {open ? (
          <ChevronDown size={12} className="shrink-0 text-white/30" />
        ) : (
          <ChevronRight size={12} className="shrink-0 text-white/30" />
        )}
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {mapped ? <StatusIcon status={mapped} size={13} /> : <CircleSlash size={12} className="text-white/30" />}
        </span>
        <span className="shrink-0 font-mono text-[12px] text-white/80">{record.name}</span>
        <span className="shrink-0 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-white/30">
          {record.type}
        </span>
        {record.note && <span className="min-w-0 truncate text-[12px] text-white/40">{record.note}</span>}
        <span className="ml-auto shrink-0 text-[11px] text-white/30">{formatDuration(record.durationMs)}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 pb-2 pr-2" style={{ paddingLeft: 40 + record.depth * 18 }}>
          {record.command && (
            <div className="flex items-start gap-1.5 rounded-md border border-clide-border bg-clide-bg px-2.5 py-2">
              <Terminal size={12} className="mt-0.5 shrink-0 text-white/30" />
              <span className="min-w-0 break-all font-mono text-[12px] text-white/70">{record.command}</span>
            </div>
          )}
          {record.resolvedInputs && Object.keys(record.resolvedInputs).length > 0 && (
            <div className="flex flex-col gap-0.5">
              {Object.entries(record.resolvedInputs).map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-3">
                  <span className="w-32 shrink-0 truncate text-[11px] font-medium text-white/40">{k}</span>
                  <span className="min-w-0 break-all text-[12px] text-white/70">
                    {typeof v === "string" ? v : JSON.stringify(v)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {(record.stdout || record.stderr) && (
            <AutoSizeOutput className="rounded-md border border-clide-border bg-clide-bg px-3 py-2 font-mono text-[12px]" capHeight={240}>
              {record.stdout && <pre className="whitespace-pre-wrap break-words text-white/70">{record.stdout}</pre>}
              {record.stderr && (
                <pre className="whitespace-pre-wrap break-words text-[rgba(255,100,100,0.85)]">{record.stderr}</pre>
              )}
            </AutoSizeOutput>
          )}
          {record.exitCode !== undefined && record.exitCode !== null && (
            <span className="text-[11px] text-white/30">exit code {record.exitCode}</span>
          )}

          {onReplay && (
            <button
              onClick={onReplay}
              disabled={replaying}
              className="flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-[12px] text-white/50 hover:bg-white/5 hover:text-white disabled:opacity-40"
            >
              <RotateCw size={12} className={replaying ? "animate-spin" : ""} />
              {replaying ? "Replaying…" : "Replay this step"}
            </button>
          )}

          {replayResult && (
            <div className="flex flex-col gap-1 rounded-md border border-sky-400/30 bg-sky-400/5 p-2.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-sky-300/80">
                Replay — does not affect this run
              </span>
              <StepTraceRow record={{ ...replayResult, depth: 0 }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run detail (ticket 85): live while running, identical rendering for
// historical runs (one component, data-source agnostic).
// ---------------------------------------------------------------------------

export function WorkflowRunDetail({ runId, onBack }: { runId: string; onBack: () => void }) {
  const { activeProject, workflows } = useApp();
  const { confirm } = useUIFeedback();
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [replays, setReplays] = useState<Record<number, WorkflowStepRecord>>({});
  const [replayingIndex, setReplayingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!activeProject) return;
    void api.getWorkflowRun(activeProject, runId).then(setRun);
  }, [activeProject, runId]);

  // Live updates stream the full run state on every step transition (ticket 80).
  useEffect(
    () =>
      on("workflowRun", (update) => {
        if (update.runId === runId) setRun(update);
      }),
    [runId],
  );

  const replay = async (recordIndex: number, record: WorkflowStepRecord) => {
    if (!activeProject) return;
    const res = await confirm({
      title: `Replay "${record.name}"?`,
      message: `Re-runs this one step with its captured inputs — the command has real side effects:\n${record.command ?? ""}`,
      confirmLabel: "Replay",
      danger: false,
    });
    if (!res.ok) return;
    setReplayingIndex(recordIndex);
    const result = await api.replayWorkflowStep(activeProject, runId, recordIndex);
    setReplayingIndex(null);
    if (result.ok && result.record) setReplays((prev) => ({ ...prev, [recordIndex]: result.record! }));
  };

  const definitionChanged = useMemo(() => {
    if (!run) return false;
    const current = workflows.find((w) => w.id === run.workflowId);
    if (!current) return true;
    return JSON.stringify(current.steps) !== JSON.stringify(run.workflow.steps);
  }, [run, workflows]);

  if (!run) return <div className="px-2 py-6 text-center text-[13px] text-white/30">Loading run…</div>;

  const runStatusIcon: RunStatus =
    run.status === "running" ? "running" : run.status === "succeeded" ? "success" : "error";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 rounded px-2 py-1 text-[12px] text-white/50 hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft size={13} /> Runs
        </button>
        <StatusIcon status={runStatusIcon} size={15} />
        <span className="text-[14px] font-bold text-white">{run.workflowName}</span>
        <span className="text-[12px] text-white/40">
          {triggerLabel(run)} · {new Date(run.startedAt).toLocaleString()}
        </span>
        <div className="flex-1" />
        {run.status === "running" && activeProject && (
          <button
            onClick={() => void api.cancelWorkflowRun(activeProject, run.runId)}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
          >
            <Square size={12} /> Cancel
          </button>
        )}
      </div>
      {definitionChanged && (
        <span className="text-[11px] text-white/30">
          This run used an older version of the workflow — the trace reflects its snapshot.
        </span>
      )}

      <div className="flex flex-col divide-y divide-white/5 rounded-md border border-clide-border">
        {run.records.length === 0 && <div className="px-3 py-4 text-[13px] text-white/30">Starting…</div>}
        {run.records.map((record, i) => (
          <StepTraceRow
            key={i}
            record={record}
            onReplay={
              record.type === "form" && (record.status === "succeeded" || record.status === "failed")
                ? () => void replay(i, record)
                : undefined
            }
            replayResult={replays[i]}
            replaying={replayingIndex === i}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dry-run plan rendering (ticket 86): nothing executed, nothing persisted.
// ---------------------------------------------------------------------------

export function DryRunView({ plan, problems, onClose }: { plan: WorkflowPlanEntry[]; problems: string[]; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onClose}
          className="flex items-center gap-1 rounded px-2 py-1 text-[12px] text-white/50 hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft size={13} /> Back
        </button>
        <span className="text-[14px] font-bold text-white">Dry run</span>
        <span className="text-[12px] text-white/40">what would execute — nothing ran, nothing was recorded</span>
      </div>
      {problems.length > 0 && (
        <div className="flex flex-col gap-0.5 rounded-md border border-amber-400/30 bg-amber-400/5 px-3 py-2">
          {problems.map((p, i) => (
            <span key={i} className="text-[12px] text-amber-200">
              {p}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col divide-y divide-white/5 rounded-md border border-clide-border">
        {plan.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1.5" style={{ paddingLeft: 8 + entry.depth * 18 }}>
            <span className="shrink-0 font-mono text-[12px] text-white/70">{entry.name}</span>
            <span className="shrink-0 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-white/30">
              {entry.type}
            </span>
            <span className="min-w-0 break-all font-mono text-[12px] text-white/50">{entry.summary}</span>
            {entry.note && <span className="ml-auto shrink-0 text-[11px] text-white/30">{entry.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
