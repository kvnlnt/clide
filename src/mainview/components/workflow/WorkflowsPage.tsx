import { Copy, FlaskConical, ListChecks, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { api, on } from "../../rpc";
import type { RunStatus, Workflow, WorkflowPlanEntry, WorkflowRunSummary } from "../../types/tasks";
import Modal from "../Modal";
import StatusIcon from "../statusIcon";
import { useUIFeedback } from "../UIFeedback";
import { DryRunView, WorkflowRunDetail } from "./WorkflowRunView";

const inputBase =
  "w-full rounded border border-clide-border bg-clide-surface text-white text-[13px] px-2.5 py-1.5 outline-none placeholder:text-white/30 focus:border-white/30";

function triggerSummary(w: Workflow): string {
  if (w.triggers.length === 0) return "no triggers";
  return w.triggers
    .map((t) => (t.type === "manual" ? "manual" : t.type === "schedule" ? `cron ${t.cron}` : `on ${t.taskSlug}`))
    .join(" · ");
}

/** Prompt for a workflow's declared manual-run parameters (ticket 90). */
function ParamsPrompt({
  workflow,
  onRun,
  onClose,
}: {
  workflow: Workflow;
  onRun: (params: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <Modal onClose={onClose} widthClassName="w-[420px]" panelClassName="overflow-hidden">
      <div className="flex flex-col gap-3 px-5 py-4">
        <span className="text-[14px] font-bold text-white">Run "{workflow.name}"</span>
        {(workflow.params ?? []).map((p) => (
          <div key={p} className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-white/60">{p}</label>
            <input
              className={inputBase}
              value={values[p] ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [p]: e.target.value }))}
            />
          </div>
        ))}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-[13px] text-white/50 hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={() => onRun(values)}
            className="rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20"
          >
            Run
          </button>
        </div>
      </div>
    </Modal>
  );
}

type PageView =
  | { kind: "list" }
  | { kind: "runs"; workflowId: string }
  | { kind: "run"; runId: string; backTo: PageView }
  | { kind: "plan"; plan: WorkflowPlanEntry[]; problems: string[] };

/**
 * Workflows surface (ticket 93): list with enable toggle, trigger summary,
 * last-run status, and Run / Dry run / Edit / Runs / Delete — plus the runs
 * tab (ticket 94) and dry-run plan (ticket 95) hosted as drill-in views.
 */
export default function WorkflowsPage() {
  const { activeProject, workflows, saveWorkflow, deleteWorkflowById, openWorkflowEditor, refreshWorkflows } = useApp();
  const { confirm, toast } = useUIFeedback();
  const [view, setView] = useState<PageView>({ kind: "list" });
  const [runs, setRuns] = useState<WorkflowRunSummary[]>([]);
  const [paramsFor, setParamsFor] = useState<Workflow | null>(null);

  const loadRuns = (workflowId?: string) => {
    if (!activeProject) return;
    void api.listWorkflowRuns(activeProject, workflowId).then(setRuns);
  };

  useEffect(() => {
    loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject]);

  // A live run's transitions refresh whichever list is showing.
  useEffect(
    () =>
      on("workflowRun", () => {
        if (view.kind === "runs") loadRuns(view.workflowId);
        else if (view.kind === "list") loadRuns();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, activeProject],
  );

  const start = async (workflow: Workflow, params: Record<string, string>) => {
    if (!activeProject) return;
    const res = await api.startWorkflowRun(activeProject, workflow.id, params);
    if (!res.ok || !res.runId) {
      toast(res.error ?? "Couldn't start the workflow", "error");
      return;
    }
    toast(`Started "${workflow.name}"`);
    setView({ kind: "run", runId: res.runId, backTo: { kind: "list" } });
  };

  const run = (workflow: Workflow) => {
    if (!workflow.enabled) {
      toast("This workflow is disabled — enable it first.", "error");
      return;
    }
    if ((workflow.params ?? []).length > 0) setParamsFor(workflow);
    else void start(workflow, {});
  };

  const dryRun = async (workflow: Workflow) => {
    if (!activeProject) return;
    const res = await api.dryRunWorkflow(activeProject, workflow.id, {});
    if (!res.ok || !res.plan) {
      toast(res.error ?? "Dry run failed", "error");
      return;
    }
    setView({ kind: "plan", plan: res.plan, problems: res.problems ?? [] });
  };

  const remove = async (workflow: Workflow) => {
    const res = await confirm({
      title: `Delete workflow "${workflow.name}"?`,
      message: "Its definition file is removed; past run traces are kept.",
      confirmLabel: "Delete",
    });
    if (!res.ok) return;
    await deleteWorkflowById(workflow.id);
    toast("Workflow deleted");
  };

  const lastRunFor = (workflowId: string): WorkflowRunSummary | undefined =>
    runs.find((r) => r.workflowId === workflowId);

  const runStatusIcon = (status: WorkflowRunSummary["status"]): RunStatus =>
    status === "running" ? "running" : status === "succeeded" ? "success" : "error";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-baseline gap-2 px-8 pb-4 pt-7">
        <h1 className="text-[20px] font-bold text-white">Workflows</h1>
        <span className="text-[13px] text-white/40">{activeProject}</span>
        <div className="flex-1" />
        <button
          onClick={() => openWorkflowEditor()}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] text-white/60 hover:bg-white/5 hover:text-white"
        >
          <Plus size={13} /> New workflow
        </button>
      </div>

      <div className="clide-scroll flex-1 overflow-y-auto px-8 pb-8">
        {view.kind === "run" && <WorkflowRunDetail runId={view.runId} onBack={() => setView(view.backTo)} />}

        {view.kind === "plan" && (
          <DryRunView plan={view.plan} problems={view.problems} onClose={() => setView({ kind: "list" })} />
        )}

        {view.kind === "runs" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView({ kind: "list" })}
                className="rounded px-2 py-1 text-[12px] text-white/50 hover:bg-white/5 hover:text-white"
              >
                ← Workflows
              </button>
              <span className="text-[14px] font-bold text-white">
                {workflows.find((w) => w.id === view.workflowId)?.name ?? "Runs"} — runs
              </span>
            </div>
            <div className="flex flex-col divide-y divide-white/5 rounded-md border border-clide-border">
              {runs.filter((r) => r.workflowId === view.workflowId).length === 0 && (
                <div className="px-3 py-4 text-[13px] text-white/30">No runs yet.</div>
              )}
              {runs
                .filter((r) => r.workflowId === view.workflowId)
                .map((r) => (
                  <button
                    key={r.runId}
                    onClick={() => setView({ kind: "run", runId: r.runId, backTo: view })}
                    className="flex items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.03]"
                  >
                    <StatusIcon status={runStatusIcon(r.status)} size={14} />
                    <span className="text-[13px] text-white/80">{new Date(r.startedAt).toLocaleString()}</span>
                    <span className="text-[12px] text-white/40">
                      {r.trigger.type === "manual"
                        ? "manual"
                        : r.trigger.type === "schedule"
                          ? "schedule"
                          : `on ${r.trigger.detail}`}
                    </span>
                    <span className="ml-auto text-[11px] text-white/30">
                      {r.finishedAt
                        ? `${((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 1000).toFixed(1)}s`
                        : "running…"}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {view.kind === "list" &&
          (workflows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
                <ListChecks size={20} className="text-white/40" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[14px] font-medium text-white/70">No workflows yet</span>
                <span className="text-[13px] text-white/40">
                  Orchestrate this project's tasks into multi-step automations.
                </span>
              </div>
              <button
                onClick={() => openWorkflowEditor()}
                className="rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20"
              >
                New workflow
              </button>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-white/5 border-t border-white/5">
              {workflows.map((w) => {
                const last = lastRunFor(w.id);
                return (
                  <div key={w.id} className="flex items-center gap-3 py-3">
                    <label className="flex shrink-0 items-center" title={w.enabled ? "Enabled" : "Disabled"}>
                      <input
                        type="checkbox"
                        checked={w.enabled}
                        onChange={(e) => void saveWorkflow({ ...w, enabled: e.target.checked })}
                      />
                    </label>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`truncate text-[14px] ${w.enabled ? "text-white" : "text-white/40"}`}>
                          {w.name}
                        </span>
                        {last && <StatusIcon status={runStatusIcon(last.status)} size={13} />}
                      </div>
                      <span className="block truncate text-[12px] text-white/40">
                        {triggerSummary(w)}
                        {w.description ? ` — ${w.description}` : ""}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => run(w)}
                        title="Run now"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
                      >
                        <Play size={13} />
                      </button>
                      <button
                        onClick={() => void dryRun(w)}
                        title="Dry run — show the commands without executing"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
                      >
                        <FlaskConical size={13} />
                      </button>
                      <button
                        onClick={() => {
                          setView({ kind: "runs", workflowId: w.id });
                          loadRuns(w.id);
                        }}
                        className="rounded-md px-2.5 py-1 text-[12px] text-white/60 hover:bg-white/5 hover:text-white"
                      >
                        Runs
                      </button>
                      <button
                        onClick={() => openWorkflowEditor(w)}
                        title="Edit"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={async () => {
                          if (!activeProject) return;
                          const res = await api.duplicateWorkflow(activeProject, w.id);
                          if (!res.ok || !res.workflow) {
                            toast(res.error ?? "Couldn't duplicate workflow", "error");
                            return;
                          }
                          toast(`Duplicated '${w.name}'`);
                          await refreshWorkflows();
                          openWorkflowEditor(res.workflow, true);
                        }}
                        title="Duplicate"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={() => void remove(w)}
                        title="Delete"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-red-400/70 hover:bg-white/10 hover:text-red-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
      </div>

      {paramsFor && (
        <ParamsPrompt
          workflow={paramsFor}
          onClose={() => setParamsFor(null)}
          onRun={(params) => {
            setParamsFor(null);
            void start(paramsFor, params);
          }}
        />
      )}
    </div>
  );
}
