import { Braces, Code, Eye } from "lucide-react";
import type { FormDefinition, FormMeta, RunRecord } from "../types/forms";
import EllipsisMenu from "./EllipsisMenu";
import StatusIcon from "./statusIcon";

const TABS = [
  { id: "results", label: "Results", icon: Eye },
  { id: "submitted", label: "Submitted", icon: Braces },
  { id: "code", label: "Code", icon: Code },
] as const;

interface FormCardHeaderProps {
  meta: FormMeta;
  form: FormDefinition;
  run: RunRecord;
  /** When the card represents multiple grouped runs, show a count badge. */
  runCount?: number;
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
  showTabs?: boolean;
  activeTab?: "results" | "submitted" | "code";
  onTabChange?: (tab: "results" | "submitted" | "code") => void;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FormCardHeader({
  meta,
  form,
  run,
  runCount,
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
  showTabs,
  activeTab,
  onTabChange,
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
    <div
      className={`flex items-center gap-3 px-4 py-3 ${onToggle ? "cursor-pointer hover:bg-white/5" : ""}`}
      onClick={onToggle}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <StatusIcon status={run.status} pinned={pinned} mode="dot" />
      </span>

      <span className="shrink-0 text-[12px] font-medium text-white">
        {meta.name}
      </span>
      {runCount && runCount > 1 && (
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[12px] text-white/40 bg-white/10">
          {runCount}
        </span>
      )}

      {!expanded && (
        <span className="min-w-0 flex-1 truncate text-[12px] text-clide-muted">
          {summary}
        </span>
      )}

      {expanded && form.aiPromptField && (
        <input
          className="flex-1 bg-transparent text-[12px] italic text-white outline-none placeholder:text-white/30"
          placeholder="✦ Describe your post..."
          value={aiPrompt}
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onAiPromptChange(e.target.value)}
        />
      )}

      <div className="ml-auto flex items-center gap-3">
        {!expanded && time && (
          <span className="shrink-0 text-[12px] text-white/40">{time}</span>
        )}

        {expanded && showTabs && onTabChange && (
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                className={`flex items-center rounded-[3px] p-1.5 transition-colors ${
                  activeTab === id
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white"
                }`}
                onClick={() => onTabChange(id)}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        )}

        <div onClick={(e) => e.stopPropagation()}>
          <EllipsisMenu
            pinned={pinned}
            onPin={onPin}
            onSchedule={onSchedule}
            onRerun={onRerun}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}
