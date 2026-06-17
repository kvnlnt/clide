import type { FormMeta, RunRecord } from "../types/forms";
import EllipsisMenu from "./EllipsisMenu";
import StatusIcon from "./statusIcon";

interface FormCardCollapsedProps {
  meta: FormMeta;
  run: RunRecord;
  summary: string;
  onExpand: () => void;
  onPin: () => void;
  onSchedule: () => void;
  onRerun: () => void;
  onDelete: () => void;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function FormCardCollapsed({
  meta,
  run,
  summary,
  onExpand,
  onPin,
  onSchedule,
  onRerun,
  onDelete,
}: FormCardCollapsedProps) {
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
      className="group flex cursor-pointer items-center gap-3 rounded px-2 py-2 hover:bg-white/[0.03]"
      onClick={onExpand}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <StatusIcon status={run.status} pinned={run.pinned} size={18} />
      </span>
      <span className="shrink-0 text-[16px] text-white/60">{meta.name}</span>
      <span className="min-w-0 flex-1 truncate text-[14px] text-clide-muted">
        {summary}
      </span>
      <span className="shrink-0 text-[12px] text-white/40">{time}</span>
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <EllipsisMenu
          pinned={run.pinned}
          onPin={onPin}
          onSchedule={onSchedule}
          onRerun={onRerun}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
