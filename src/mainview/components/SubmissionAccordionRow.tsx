import { ChevronDown } from "lucide-react";
import type {
  TaskDefinition,
  OutputChunk,
  OutputType,
  RunRecord,
} from "../types/tasks";
import SubmittedSummary from "./SubmittedSummary";
import OutputBlock from "./output/OutputBlock";
import StatusIcon from "./statusIcon";

interface SubmissionAccordionRowProps {
  run: RunRecord;
  form: TaskDefinition;
  outputType?: OutputType;
  chunks: OutputChunk[];
  open: boolean;
  onToggle: () => void;
  activeTab: "results" | "submitted";
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarize(
  form: TaskDefinition,
  inputs: Record<string, unknown>,
  run: RunRecord,
): string {
  if (run.status === "error")
    return inputs.__error ? String(inputs.__error) : "Failed";
  if (run.status === "scheduled" && run.scheduledAt) {
    return new Date(run.scheduledAt).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const first = form.fields.find((f) => {
    const v = inputs[f.id];
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "string") return v.trim().length > 0;
    return v !== undefined && v !== null;
  });
  if (first) {
    const v = inputs[first.id];
    return Array.isArray(v) ? v.join(", ") : String(v);
  }
  return "";
}

export default function SubmissionAccordionRow({
  run,
  form,
  outputType,
  chunks,
  open,
  onToggle,
  activeTab,
}: SubmissionAccordionRowProps) {
  const time = formatTime(run.finishedAt ?? run.startedAt);
  const summary = summarize(form, run.inputs, run);
  const hasOutput =
    run.status === "running" ||
    run.status === "pending" ||
    run.status === "success" ||
    run.status === "error";

  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-2.5 px-4 py-2.5 hover:bg-white/[0.03]"
        onClick={onToggle}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          <StatusIcon status={run.status} size={14} />
        </span>
        <span className="shrink-0 text-[12px] text-white/40">{time}</span>
        {summary && (
          <span className="min-w-0 flex-1 truncate text-[12px] text-clide-muted">
            {summary}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`ml-auto shrink-0 text-white/30 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>
      {open && (
        <div className="px-4 pb-3">
          {hasOutput ? (
            activeTab === "results" ? (
              outputType ? (
                <OutputBlock
                  runId={run.id}
                  outputType={outputType}
                  status={run.status}
                  chunks={chunks}
                />
              ) : (
                <div className="py-2 text-[13px] text-white/40">
                  No results.
                </div>
              )
            ) : (
              <SubmittedSummary form={form} run={run} />
            )
          ) : (
            <div className="py-2 text-[13px] text-white/40">No output yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
