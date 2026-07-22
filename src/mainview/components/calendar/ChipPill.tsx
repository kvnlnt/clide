import { Workflow as WorkflowIcon } from "lucide-react";
import type { DragEvent } from "react";
import type { Chip } from "./calendarUtils";

interface ChipPillProps {
  chip: Chip;
  name: string;
  isSelected: boolean;
  /** Real (non-projected) chips are draggable onto another day/slot to reschedule (ticket 128 stretch). */
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: (e: DragEvent) => void;
  onSelect: () => void;
}

/** One scheduled task/workflow pill — the shared visual language across Month/Week/Day views. */
export default function ChipPill({ chip, name, isSelected, onDragStart, onDragEnd, onSelect }: ChipPillProps) {
  return (
    <button
      draggable={!chip.projected && !!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      disabled={chip.projected}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      title={`${name} — ${chip.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
      className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] ${
        chip.projected
          ? "border border-dashed border-white/10 text-white/30"
          : chip.kind === "workflow"
            ? `cursor-grab text-orange-200/90 hover:bg-orange-400/20 active:cursor-grabbing ${isSelected ? "bg-orange-400/25" : "bg-orange-400/10"}`
            : `cursor-grab text-white/80 hover:bg-white/10 active:cursor-grabbing ${isSelected ? "bg-white/15" : "bg-white/5"}`
      }`}
    >
      {chip.kind === "workflow" && <WorkflowIcon size={10} className="shrink-0" />}
      <span className="truncate">
        {chip.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {name}
      </span>
    </button>
  );
}
