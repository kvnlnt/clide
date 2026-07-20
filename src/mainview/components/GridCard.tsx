import { GripVertical, Maximize2, Play } from "lucide-react";
import type { TaskFolder, GridCardSize, RunRecord } from "../types/tasks";
import StatusIcon from "./statusIcon";

interface GridCardProps {
  task: TaskFolder;
  size: GridCardSize;
  lastRun: RunRecord | undefined;
  pinned: boolean;
  onOpen: () => void;
  onQuickRun: () => void;
  onCycleSize: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}

const SPAN: Record<GridCardSize, string> = {
  small: "col-span-1",
  medium: "col-span-2",
  large: "col-span-3",
};
const MIN_H: Record<GridCardSize, string> = {
  small: "min-h-[100px]",
  medium: "min-h-[160px]",
  large: "min-h-[240px]",
};

function lastRunTime(run: RunRecord | undefined): string {
  if (!run) return "Never run";
  const iso = run.finishedAt ?? run.startedAt;
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function GridCard({
  task,
  size,
  lastRun,
  pinned,
  onOpen,
  onQuickRun,
  onCycleSize,
  onDragStart,
  onDragOver,
  onDrop,
}: GridCardProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onOpen}
      className={`group relative flex cursor-pointer flex-col justify-between rounded-[5px] border bg-clide-panel p-3 ${
        pinned ? "border-white/25" : "border-clide-border"
      } ${SPAN[size]} ${MIN_H[size]}`}
    >
      <div className="flex items-start justify-between">
        <span className="text-[14px] font-bold text-white">{task.meta.name}</span>
        <span
          className="hidden cursor-grab text-white/30 group-hover:block"
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={14} />
        </span>
      </div>

      {size !== "small" && task.meta.description && (
        <p className="mt-1 line-clamp-3 text-[12px] text-white/40">{task.meta.description}</p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon status={lastRun?.status ?? "idle"} size={16} />
          <span className="text-[12px] text-white/40">{lastRunTime(lastRun)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-white/40 hover:text-white"
            title="Resize"
            onClick={(e) => {
              e.stopPropagation();
              onCycleSize();
            }}
          >
            <Maximize2 size={14} />
          </button>
          <button
            className="text-white/60 hover:text-white"
            title="Run"
            onClick={(e) => {
              e.stopPropagation();
              onQuickRun();
            }}
          >
            <Play size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
