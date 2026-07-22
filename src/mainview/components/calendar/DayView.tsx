import { useMemo } from "react";
import type { TaskFolder } from "../../types/tasks";
import TimeGrid from "./TimeGrid";
import type { Chip, Selected } from "./calendarUtils";

interface DayViewProps {
  day: Date;
  chipsByDay: Map<string, Chip[]>;
  tasksBySlug: Map<string, TaskFolder>;
  selected: Selected;
  onSelectChip: (chip: Chip) => void;
  onSlotClick: (slot: Date) => void;
  onDropChip: (chip: Chip, slot: Date) => void;
}

/** Single-column hour axis for one day (ticket 128) — the drill-in target from Month's "+N more". */
export default function DayView({ day, chipsByDay, tasksBySlug, selected, onSelectChip, onSlotClick, onDropChip }: DayViewProps) {
  const days = useMemo(() => [day], [day]);
  return (
    <TimeGrid
      days={days}
      chipsByDay={chipsByDay}
      tasksBySlug={tasksBySlug}
      selected={selected}
      onSelectChip={onSelectChip}
      onSlotClick={onSlotClick}
      onDropChip={onDropChip}
    />
  );
}
