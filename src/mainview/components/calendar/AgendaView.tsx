import { Plus, Repeat, Workflow as WorkflowIcon } from "lucide-react";
import { useMemo } from "react";
import type { TaskFolder } from "../../types/tasks";
import { chipName, chipRepeat, isSameDay, isoDate } from "./calendarUtils";
import type { Chip, Selected } from "./calendarUtils";

interface AgendaViewProps {
  /** Flat, chronologically sorted chip list — real and projected occurrences alike. */
  chips: Chip[];
  tasksBySlug: Map<string, TaskFolder>;
  selected: Selected;
  onSelectChip: (chip: Chip) => void;
  onScheduleForDate: (day: Date) => void;
}

const REPEAT_LABEL: Record<string, string> = { daily: "Repeats daily", weekly: "Repeats weekly" };

/**
 * Flat chronological list of upcoming occurrences (ticket 128) — the "show me
 * everything recurring/upcoming" surface that was previously only reachable
 * by scanning the month grid. Recurring items (real or projected occurrence)
 * are labeled; every row is clickable, including projected occurrences,
 * since the point here is fast access to the underlying series.
 */
export default function AgendaView({ chips, tasksBySlug, selected, onSelectChip, onScheduleForDate }: AgendaViewProps) {
  const groups = useMemo(() => {
    const map = new Map<string, { day: Date; chips: Chip[] }>();
    for (const chip of chips) {
      const key = isoDate(chip.date);
      const g = map.get(key);
      if (g) g.chips.push(chip);
      else map.set(key, { day: chip.date, chips: [chip] });
    }
    return [...map.values()];
  }, [chips]);

  if (groups.length === 0) {
    return <div className="mt-6 text-center text-[13px] text-white/30">Nothing upcoming in this window.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ day, chips: dayChips }) => (
        <div key={isoDate(day)} className="flex flex-col gap-1">
          <div className="flex items-center gap-2 border-b border-clide-border pb-1">
            <span className={`text-[12px] font-medium ${isSameDay(day, new Date()) ? "text-white" : "text-white/50"}`}>
              {day.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
            </span>
            {isSameDay(day, new Date()) && (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-white/50">Today</span>
            )}
            <div className="flex-1" />
            <button
              onClick={() => onScheduleForDate(day)}
              title="Schedule a task or workflow for this day"
              className="flex h-5 w-5 items-center justify-center rounded text-white/30 hover:bg-white/10 hover:text-white"
            >
              <Plus size={12} />
            </button>
          </div>
          {dayChips.map((chip) => {
            const name = chipName(chip, tasksBySlug);
            const repeat = chipRepeat(chip);
            const isSelected = selected?.kind === chip.kind && selected.id === chip.item.id;
            return (
              <button
                key={chip.key}
                onClick={() => onSelectChip(chip)}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${
                  isSelected ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <span className="w-14 shrink-0 text-[11px] text-white/40">
                  {chip.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                {chip.kind === "workflow" ? (
                  <WorkflowIcon size={12} className="shrink-0 text-orange-300/70" />
                ) : (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-white/40" />
                )}
                <span className={`min-w-0 truncate ${chip.kind === "workflow" ? "text-orange-200/90" : "text-white/80"}`}>
                  {name}
                </span>
                {chip.projected && <span className="shrink-0 text-[10px] text-white/30">(projected)</span>}
                {repeat !== "none" && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">
                    <Repeat size={9} /> {REPEAT_LABEL[repeat]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
