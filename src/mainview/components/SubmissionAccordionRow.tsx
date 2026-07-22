import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import type { RunArtifact } from "../../shared/types";
import { useApp } from "../context/AppContext";
import { api } from "../rpc";
import type { OutputChunk, OutputType, RunRecord, TaskDefinition } from "../types/tasks";
import SubmittedSummary from "./SubmittedSummary";
import { ArtifactModal } from "./files/ArtifactModal";
import OutputBlock from "./output/OutputBlock";
import StatusIcon from "./statusIcon";

interface SubmissionAccordionRowProps {
  run: RunRecord;
  taskDef: TaskDefinition;
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

function summarize(taskDef: TaskDefinition, inputs: Record<string, unknown>, run: RunRecord): string {
  // Ticket 98: use AI summary when present
  if (run.summary) return run.summary;

  // Scheduled runs show the fire time
  if (run.status === "scheduled" && run.scheduledAt) {
    return new Date(run.scheduledAt).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Fallback heuristic (ticket 98 §3)
  if (run.status === "error") {
    return inputs.__error ? String(inputs.__error) : "Failed";
  }

  // Success: first filled field with label
  const first = taskDef.fields.find((f) => {
    const v = inputs[f.id];
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "string") return v.trim().length > 0;
    return v !== undefined && v !== null;
  });
  if (first) {
    const v = inputs[first.id];
    const displayValue = Array.isArray(v) ? v.join(", ") : String(v);
    return `${first.label}: ${displayValue}`;
  }
  return "";
}

export default function SubmissionAccordionRow({
  run,
  taskDef,
  outputType,
  chunks,
  open,
  onToggle,
  activeTab,
}: SubmissionAccordionRowProps) {
  const { markRunRead } = useApp();
  const [artifacts, setArtifacts] = useState<RunArtifact[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<RunArtifact | null>(null);

  useEffect(() => {
    if (open && (run.status === "success" || run.status === "error")) {
      api.getRunArtifacts(run.id).then(setArtifacts);
    }
  }, [open, run.id, run.status]);

  const time = formatTime(run.finishedAt ?? run.startedAt);
  const summary = summarize(taskDef, run.inputs, run);
  const hasOutput =
    run.status === "running" || run.status === "pending" || run.status === "success" || run.status === "error";

  // Subtle shimmer while summary is pending (ticket 98)
  const summaryPending =
    (run.status === "success" || run.status === "error") && run.finishedAt && !run.summary && !run.triggeredBy;

  // Unread rows read bolder than normal; clears once expanded (ticket 97) or
  // explicitly marked read (ticket 126 sidebar "mark all read").
  const isUnread = (run.status === "success" || run.status === "error") && !run.readAt;

  const handleToggle = () => {
    onToggle();
    // Mark read when expanding (ticket 97). Already-read runs are harmless.
    if (!open && (run.status === "success" || run.status === "error") && !run.readAt) {
      void markRunRead(run.id);
    }
  };

  const getKindIcon = (kind: RunArtifact["kind"]) => {
    switch (kind) {
      case "created":
        return "✨";
      case "modified":
        return "✏️";
      case "deleted":
        return "🗑️";
    }
  };

  const getTypeIcon = (mime?: string) => {
    if (!mime) return "📄";
    if (mime.startsWith("image/")) return "🖼️";
    if (mime.startsWith("video/")) return "🎬";
    if (mime.startsWith("audio/")) return "🎵";
    if (mime === "application/pdf") return "📕";
    if (mime === "application/json" || mime === "text/") return "📝";
    return "📄";
  };

  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-2.5 px-[var(--clide-card-x)] py-[var(--clide-row-y)] hover:bg-white/[0.03]"
        onClick={handleToggle}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          <StatusIcon status={run.status} size={14} />
        </span>
        <span className="clide-vertical-label shrink-0 text-[12px] text-white/40">{time}</span>
        {summary && (
          <span
            className={`min-w-0 flex-1 truncate text-[12px] ${isUnread ? "font-semibold text-white" : "text-clide-muted"} ${
              summaryPending ? "animate-pulse opacity-60" : ""
            }`}
          >
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
              <>
                {outputType ? (
                  <OutputBlock runId={run.id} outputType={outputType} status={run.status} chunks={chunks} />
                ) : (
                  <div className="py-2 text-[13px] text-white/40">No results.</div>
                )}

                {/* Artifacts strip (ticket 102) */}
                {artifacts.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="text-[11px] text-white/40 mb-2 uppercase tracking-wide">Artifacts</div>
                    <div className="flex flex-wrap gap-2">
                      {artifacts.map((artifact, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedArtifact(artifact)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] transition-colors ${
                            artifact.kind === "deleted"
                              ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                              : artifact.kind === "modified"
                                ? "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                                : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                          }`}
                        >
                          <span>{getTypeIcon(artifact.mime)}</span>
                          <span className="truncate max-w-[200px]">{artifact.name}</span>
                          <span className="opacity-70">{getKindIcon(artifact.kind)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <SubmittedSummary taskDef={taskDef} run={run} />
            )
          ) : (
            <div className="py-2 text-[13px] text-white/40">No output yet.</div>
          )}
        </div>
      )}

      {/* Artifact preview modal */}
      {selectedArtifact && <ArtifactModal artifact={selectedArtifact} onClose={() => setSelectedArtifact(null)} />}
    </div>
  );
}
