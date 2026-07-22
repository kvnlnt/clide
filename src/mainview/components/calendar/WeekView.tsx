import { useMemo } from "react";
import type { TaskFolder } from "../../types/tasks";
import TimeGrid from "./TimeGrid";
import { addDays, startOfWeek } from "./calendarUtils";
import type { Chip, Selected } from "./calendarUtils";

interface WeekViewProps {
  /** Any day within the week to display — normalized to Sunday internally. */
  anchor: Date;
  chipsByDay: Map<string, Chip[]>;
  tasksBySlug: Map<string, TaskFolder>;
  selected: Selected;
  onSelectChip: (chip: Chip) => void;
  onSlotClick: (slot: Date) => void;
  onDropChip: (chip: Chip, slot: Date) => void;
}

/** Seven-column hour axis for one week (ticket 128). */
export default function WeekView({ anchor, chipsByDay, tasksBySlug, selected, onSelectChip, onSlotClick, onDropChip }: WeekViewProps) {
  const days = useMemo(() => {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor]);
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
