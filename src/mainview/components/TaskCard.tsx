import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../rpc";
import type {
  OutputChunk,
  OutputType,
  RepeatInterval,
  RunRecord,
  RunStatus,
  TaskDefinition,
  TaskMeta,
} from "../types/tasks";
import ScheduleSubForm from "./ScheduleSubForm";
import SubmissionAccordion from "./SubmissionAccordion";
import SubmittedSummary from "./SubmittedSummary";
import TaskCardBody from "./TaskCardBody";
import TaskCardFooter from "./TaskCardFooter";
import TaskCardHeader from "./TaskCardHeader";
import OutputBlock from "./output/OutputBlock";

export interface TaskCardProps {
  /** All runs for this group, newest first. Single-run groups have length 1. */
  runs: RunRecord[];
  form: TaskDefinition;
  meta: TaskMeta;
  outputType?: OutputType;
  /** Keyed by run id — full chunks map passed down so accordion rows can slice. */
  chunks?: Record<string, OutputChunk[]>;
  defaultExpanded?: boolean;
  onSubmit: (values: Record<string, unknown>) => void;
  onCancel: () => void;
  onSchedule: (values: Record<string, unknown>, scheduledAt: string, repeat: RepeatInterval) => void;
  onPin: () => void;
  onDelete: (runId: string) => void;
  onRerun: () => void;
  onDismiss?: () => void;
  /** Fresh draft cards auto-fill their magic fields on mount (ticket 24). */
  autoFill?: boolean;
}

function isFilled(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
}

function summarize(form: TaskDefinition, inputs: Record<string, unknown>, run: RunRecord): string {
  // Ticket 98: use AI summary when present
  if (run.summary) return run.summary;

  // Scheduled runs show the fire time
  if (run.status === "scheduled" && run.scheduledAt) {
    return `Scheduled for ${new Date(run.scheduledAt).toLocaleString()}`;
  }

  // Fallback heuristic (ticket 98 §3)
  if (run.status === "error") {
    return inputs.__error ? String(inputs.__error) : "Failed";
  }

  // Success: first filled field with label
  const first = form.fields.find((f) => isFilled(inputs[f.id]));
  if (first) {
    const v = inputs[first.id];
    const displayValue = Array.isArray(v) ? v.join(", ") : String(v);
    return `${first.label}: ${displayValue}`;
  }
  return "";
}

/** Summary for grouped runs (ticket 98 §2): latest run's summary with terse rollup for mixed outcomes. */
function summarizeGroup(runs: RunRecord[], form: TaskDefinition): string {
  if (runs.length === 0) return "";

  const latest = runs[0];
  const latestSummary = summarize(form, latest.inputs, latest);

  // Single run — just use its summary
  if (runs.length === 1) return latestSummary;

  // Mixed outcomes: prefix with rollup
  const hasError = runs.some((r) => r.status === "error");
  const hasSuccess = runs.some((r) => r.status === "success");
  if (hasError && hasSuccess) {
    const errorCount = runs.filter((r) => r.status === "error").length;
    return `${runs.length} runs, ${errorCount} failed — ${latestSummary}`;
  }

  // Homogeneous outcomes: just show latest
  return latestSummary;
}

export default function TaskCard({
  runs,
  form,
  meta,
  outputType,
  chunks = {},
  defaultExpanded,
  onSubmit,
  onCancel,
  onSchedule,
  onPin,
  onDelete,
  onRerun,
  onDismiss,
  autoFill,
}: TaskCardProps) {
  // The latest (newest) run drives the card-level state.
  const run = runs[0];
  const isGrouped = runs.length > 1;

  const editable = run.status === "idle";
  const running = run.status === "running" || run.status === "pending";
  const hasSubmittedTabs =
    run.status === "running" || run.status === "pending" || run.status === "success" || run.status === "error";

  const [values, setValues] = useState<Record<string, unknown>>(run.inputs);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded ?? (run.status === "idle" || running));
  const [activeTab, setActiveTab] = useState<"results" | "submitted">("results");

  // Magic fill on open (ticket 24) — only fresh draft cards.
  const [filling, setFilling] = useState<Set<string>>(new Set());
  const [fillFailed, setFillFailed] = useState(false);
  const touchedRef = useRef<Set<string>>(new Set());
  const fillRequestedRef = useRef(false);

  useEffect(() => {
    if (!autoFill || fillRequestedRef.current) return;
    fillRequestedRef.current = true;
    const magicFields: Record<string, string> = {};
    for (const f of form.fields) {
      if (f.magic?.prompt) magicFields[f.id] = f.magic.prompt;
    }
    const ids = Object.keys(magicFields);
    if (ids.length === 0) return;
    setFilling(new Set(ids));
    void api.fillMagicFields(meta.slug, magicFields).then((result) => {
      setFilling(new Set());
      if (result.ok && result.values) {
        setValues((prev) => {
          const next = { ...prev };
          for (const [id, value] of Object.entries(result.values!)) {
            // Never overwrite values the user typed while the fill was pending.
            if (!touchedRef.current.has(id)) next[id] = value;
          }
          return next;
        });
      } else {
        setFillFailed(true);
      }
    });
  }, [autoFill, form.fields, meta.slug]);

  const canSubmit = useMemo(
    () => form.fields.every((f) => !f.required || isFilled(values[f.id])),
    [form.fields, values],
  );

  const setValue = (id: string, value: unknown) => {
    touchedRef.current.add(id);
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  const shouldExpand = run.status === "idle" || running ? true : expanded;
  const toggleable = !(run.status === "idle" || running);

  const statusCounts = useMemo(() => {
    const counts: Partial<Record<RunStatus, number>> = {};
    for (const r of runs) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return counts;
  }, [runs]);

  const submitPayload = () => ({
    ...values,
    ...(form.aiPromptField && aiPrompt ? { __aiPrompt: aiPrompt } : {}),
  });

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-clide-surface ${
        running ? "animate-pulse border-white/20" : "border-clide-border"
      }`}
    >
      <TaskCardHeader
        meta={meta}
        form={form}
        run={run}
        statusCounts={statusCounts}
        summary={summarizeGroup(runs, form)}
        expanded={shouldExpand}
        onToggle={toggleable ? () => setExpanded((e) => !e) : undefined}
        aiPrompt={aiPrompt}
        onAiPromptChange={setAiPrompt}
        disabled={!editable}
        pinned={run.pinned}
        onPin={onPin}
        onSchedule={() => setShowSchedule((s) => !s)}
        onRerun={onRerun}
        onDelete={() => onDelete(run.id)}
        onUndo={() => {
          if (run.status === "idle" && onDismiss) onDismiss();
          else if (!editable) setExpanded(false);
        }}
        showTabs={hasSubmittedTabs || isGrouped}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {shouldExpand && (
        <>
          <div className="h-px bg-clide-border" />

          {isGrouped ? (
            // Grouped: show accordion — each run is independently expandable.
            <SubmissionAccordion
              runs={runs}
              form={form}
              outputType={outputType}
              chunks={chunks}
              activeTab={activeTab}
            />
          ) : hasSubmittedTabs ? (
            // Single completed run: Results / Submitted tabs.
            <>
              {activeTab === "results" ? (
                outputType ? (
                  <OutputBlock
                    runId={run.id}
                    outputType={outputType}
                    status={run.status}
                    chunks={chunks[run.id] ?? []}
                  />
                ) : (
                  <div className="px-5 py-3 text-[13px] text-white/40">No results.</div>
                )
              ) : (
                <SubmittedSummary form={form} run={run} />
              )}
            </>
          ) : (
            // Single idle run: editable form body.
            <TaskCardBody
              form={form}
              values={values}
              onChange={setValue}
              disabled={!editable}
              filling={filling}
              fillFailed={fillFailed}
              taskSlug={meta.slug}
            />
          )}

          {showSchedule && editable && (
            <div className="px-5 pb-3">
              <ScheduleSubForm
                onSchedule={(at, repeat) => {
                  onSchedule(submitPayload(), at, repeat);
                  setShowSchedule(false);
                }}
                onCancel={() => setShowSchedule(false)}
              />
            </div>
          )}

          {(editable || running) && (
            <>
              <div className="h-px bg-clide-border" />
              <TaskCardFooter
                status={run.status}
                canSubmit={canSubmit}
                onSubmit={() => onSubmit(submitPayload())}
                onCancel={onCancel}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
