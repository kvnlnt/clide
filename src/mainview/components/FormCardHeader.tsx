import { ExternalLink, Undo2 } from "lucide-react";
import type { FormDefinition, FormMeta, RunRecord } from "../types/forms";
import EllipsisMenu from "./EllipsisMenu";
import StatusIcon from "./statusIcon";

interface FormCardHeaderProps {
  meta: FormMeta;
  form: FormDefinition;
  run: RunRecord;
  summary: string;
  expanded: boolean;
  onToggle?: () => void;
  aiPrompt: string;
  onAiPromptChange: (v: string) => void;
  disabled?: boolean;
  pinned: boolean;
  onPin: () => void;
  onSchedule: () => void;
  onRerun: () => void;
  onDelete: () => void;
  onUndo: () => void;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function FormCardHeader({
  meta,
  form,
  run,
  summary,
  expanded,
  onToggle,
  aiPrompt,
  onAiPromptChange,
  disabled,
  pinned,
  onPin,
  onSchedule,
  onRerun,
  onDelete,
  onUndo,
}: FormCardHeaderProps) {
  const time =
    run.status === "scheduled" && run.scheduledAt
      ? new Date(run.scheduledAt).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : formatTime(run.finishedAt ?? run.startedAt);

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <StatusIcon status={run.status} pinned={pinned} size={18} />
      </span>

      <button
        type="button"
        onClick={onToggle}
        disabled={!onToggle}
        className={`shrink-0 text-[12px] font-medium text-white ${onToggle ? "cursor-pointer" : "cursor-default"}`}
      >
        {meta.name}
      </button>

      {expanded ? (
        form.aiPromptField ? (
          <input
            className="flex-1 bg-transparent text-[12px] italic text-white outline-none placeholder:text-white/30"
            placeholder="✦ Describe your post..."
            value={aiPrompt}
            disabled={disabled}
            onChange={(e) => onAiPromptChange(e.target.value)}
          />
        ) : (
          <div className="flex-1" />
        )
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 truncate text-left text-[12px] text-clide-muted"
        >
          {summary}
        </button>
      )}

      {!expanded && time && <span className="shrink-0 text-[12px] text-white/40">{time}</span>}

      <div className="flex items-center gap-3">
        <button className="text-white/40 transition-colors hover:text-white">
          <ExternalLink size={16} />
        </button>
        {expanded && (
          <button className="text-white/40 transition-colors hover:text-white" onClick={onUndo}>
            <Undo2 size={16} />
          </button>
        )}
        <EllipsisMenu pinned={pinned} onPin={onPin} onSchedule={onSchedule} onRerun={onRerun} onDelete={onDelete} />
      </div>
    </div>
  );
}
