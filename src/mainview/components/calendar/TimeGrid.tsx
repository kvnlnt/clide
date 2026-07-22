import { useRef } from "react";
import type { TaskFolder } from "../../types/tasks";
import ChipPill from "./ChipPill";
import { HOURS, chipName, formatHour, isSameDay, isoDate } from "./calendarUtils";
import type { Chip, Selected } from "./calendarUtils";

interface TimeGridProps {
  /** One day for the Day view, seven for the Week view (ticket 128). */
  days: Date[];
  chipsByDay: Map<string, Chip[]>;
  tasksBySlug: Map<string, TaskFolder>;
  selected: Selected;
  onSelectChip: (chip: Chip) => void;
  /** Clicking an empty hour slot opens the composer prefilled with that date + hour. */
  onSlotClick: (slot: Date) => void;
  onDropChip: (chip: Chip, slot: Date) => void;
}

/** Shared hour-axis grid rendering the Day and Week calendar views (ticket 128). */
export default function TimeGrid({ days, chipsByDay, tasksBySlug, selected, onSelectChip, onSlotClick, onDropChip }: TimeGridProps) {
  const draggingRef = useRef<Chip | null>(null);
  const gridTemplateColumns = `56px repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div className="overflow-hidden rounded-md border border-clide-border bg-clide-border">
      <div className="sticky top-0 z-10 grid gap-px bg-clide-border" style={{ gridTemplateColumns }}>
        <div className="bg-clide-panel" />
        {days.map((day) => (
          <div key={day.toISOString()} className="bg-clide-panel px-2 py-1.5 text-center">
            <div className="text-[11px] font-medium text-white/40">{day.toLocaleDateString([], { weekday: "short" })}</div>
            <div className={`text-[12px] ${isSameDay(day, new Date()) ? "font-bold text-white" : "text-white/60"}`}>
              {day.getDate()}
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-px bg-clide-border" style={{ gridTemplateColumns }}>
        {HOURS.map((hour) => (
          <div key={hour} className="contents">
            <div className="flex items-start justify-end bg-clide-bg px-1.5 py-1 text-[10px] text-white/30">
              {formatHour(hour)}
            </div>
            {days.map((day) => {
              const slot = new Date(day);
              slot.setHours(hour, 0, 0, 0);
              const chips = (chipsByDay.get(isoDate(day)) ?? []).filter((c) => c.date.getHours() === hour);
              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  onClick={() => onSlotClick(slot)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const chip = draggingRef.current;
                    if (chip) onDropChip(chip, slot);
                  }}
                  className="flex min-h-[36px] cursor-pointer flex-col gap-0.5 bg-clide-bg p-0.5 hover:bg-white/[0.02]"
                >
                  {chips.map((chip) => (
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
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
