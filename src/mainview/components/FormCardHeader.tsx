import { Braces, Eye, Zap } from "lucide-react";
import { useApp } from "../context/AppContext";
import type { FormDefinition, FormMeta, RunRecord, RunStatus } from "../types/forms";
import EllipsisMenu from "./EllipsisMenu";
import { STATUS_META, STATUS_ORDER } from "./statusIcon";

const TABS = [
  { id: "results", label: "Results", icon: Eye },
  { id: "submitted", label: "Submitted", icon: Braces },
] as const;

interface FormCardHeaderProps {
  meta: FormMeta;
  form: FormDefinition;
  run: RunRecord;
  /** Count of runs in the group by status — renders one badge per nonzero status. */
  statusCounts: Partial<Record<RunStatus, number>>;
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
  activeTab?: "results" | "submitted";
  onTabChange?: (tab: "results" | "submitted") => void;
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
  statusCounts,
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
  showTabs,
  activeTab,
  onTabChange,
}: FormCardHeaderProps) {
  const { runs, formsBySlug, activeViewId } = useApp();
  // Pinning only has meaning inside saved views (ticket 27) — hide the
  // affordance entirely on the chronological title tab.
  const showPin = activeViewId !== null;

  const trigger = run.triggeredBy;
  let triggerTitle: string | null = null;
  if (trigger) {
    const sourceRun = runs.find((r) => r.id === trigger.sourceRunId);
    const sourceName = sourceRun ? formsBySlug.get(sourceRun.formSlug)?.meta.name : undefined;
    triggerTitle = `Triggered by ${trigger.event}${sourceName ? ` from ${sourceName}` : ""}`;
  }

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
      className={`flex items-center gap-3 px-5 py-3 ${onToggle ? "cursor-pointer hover:bg-white/5" : ""}`}
      onClick={onToggle}
    >
      <span className="shrink-0 text-[12px] font-medium text-white">{meta.name}</span>
      {triggerTitle && (
        <span className="flex shrink-0 items-center text-amber-300/80" title={triggerTitle}>
          <Zap size={12} />
        </span>
      )}
      <div className="flex shrink-0 items-center gap-1">
        {STATUS_ORDER.filter((s) => (statusCounts[s] ?? 0) > 0).map((s) => (
          <span
            key={s}
            title={STATUS_META[s].label}
            className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_META[s].badgeClass}`}
          >
            {statusCounts[s]}
          </span>
        ))}
      </div>

      {!expanded && <span className="min-w-0 flex-1 truncate text-[12px] text-clide-muted">{summary}</span>}

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
        {!expanded && time && <span className="shrink-0 text-[12px] text-white/40">{time}</span>}

        {expanded && showTabs && onTabChange && (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                className={`flex items-center rounded-[3px] p-1.5 transition-colors ${
                  activeTab === id ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
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
            showPin={showPin}
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
