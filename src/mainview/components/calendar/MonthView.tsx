import { Plus } from "lucide-react";
import { useMemo, useRef } from "react";
import type { TaskFolder } from "../../types/tasks";
import ChipPill from "./ChipPill";
import { DAY_NAMES, MAX_CHIPS_PER_DAY, addDays, chipName, isSameDay, isoDate, startOfGrid } from "./calendarUtils";
import type { Chip, Selected } from "./calendarUtils";

interface MonthViewProps {
  month: Date;
  chipsByDay: Map<string, Chip[]>;
  tasksBySlug: Map<string, TaskFolder>;
  selected: Selected;
  onSelectChip: (chip: Chip) => void;
  onDayClick: (day: Date) => void;
  /** "+N more" drills into the Day view for that date (ticket 128). */
  onOverflowClick: (day: Date) => void;
  onDropChip: (chip: Chip, day: Date) => void;
}

/** The existing month grid (tickets 69/117), now a standalone view within the Day/Week/Month/Agenda switcher. */
export default function MonthView({
  month,
  chipsByDay,
  tasksBySlug,
  selected,
  onSelectChip,
  onDayClick,
  onOverflowClick,
  onDropChip,
}: MonthViewProps) {
  const gridStart = useMemo(() => startOfGrid(month), [month]);
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);
  const draggingRef = useRef<Chip | null>(null);

  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-clide-border bg-clide-border">
      {DAY_NAMES.map((d) => (
        <div key={d} className="bg-clide-panel px-2 py-1.5 text-center text-[11px] font-medium text-white/40">
          {d}
        </div>
      ))}
      {days.map((day) => {
        const inMonth = day.getMonth() === month.getMonth();
        const chips = chipsByDay.get(isoDate(day)) ?? [];
        const visible = chips.slice(0, MAX_CHIPS_PER_DAY);
        const overflow = chips.length - visible.length;
        return (
          <div
            key={day.toISOString()}
            onClick={() => onDayClick(day)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const chip = draggingRef.current;
              if (chip) onDropChip(chip, day);
            }}
            className={`group flex min-h-[92px] cursor-pointer flex-col gap-1 bg-clide-bg p-1.5 hover:bg-white/[0.02] ${inMonth ? "" : "opacity-40"}`}
          >
            <span className="flex items-center justify-between">
              <span className={`text-[11px] ${isSameDay(day, new Date()) ? "font-bold text-white" : "text-white/40"}`}>
                {day.getDate()}
              </span>
              {/* Hover affordance (ticket 69): schedule a task or workflow for this day. */}
              <span
                title="Schedule a task or workflow for this day"
                className="flex h-4 w-4 items-center justify-center rounded text-white/40 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Plus size={11} />
              </span>
            </span>
            {visible.map((chip) => (
              <ChipPill
                key={chip.key}
                chip={chip}
                name={chipName(chip, tasksBySlug)}
                isSelected={selected?.kind === chip.kind && selected.id === chip.item.id}
                onSelect={() => onSelectChip(chip)}
                onDragStart={(e) => {
                  draggingRef.current = chip;
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  draggingRef.current = null;
                }}
              />
            ))}
            {overflow > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOverflowClick(day);
                }}
                className="text-left text-[10px] text-white/30 hover:text-white/60 hover:underline"
              >
                +{overflow} more
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
