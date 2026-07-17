import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import PortalPopover from "./PortalPopover";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DECADE_SIZE = 12;
const GRID_COLS = 4;

interface MonthYearPickerProps {
  /** Any date within the month currently shown by the calendar grid. */
  value: Date;
  onChange: (next: Date) => void;
}

/**
 * Click target for the calendar's "Month Year" label (ticket 80): a popover
 * with a 12-month grid for fast same-year jumps, and a year (decade) grid
 * one level up for long-range jumps, without hammering the ‹ › steppers.
 */
export default function MonthYearPicker({ value, onChange }: MonthYearPickerProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"months" | "years">("months");
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [decadeStart, setDecadeStart] = useState(() => Math.floor(value.getFullYear() / DECADE_SIZE) * DECADE_SIZE);
  const [highlight, setHighlight] = useState(0);

  const openPicker = () => {
    const y = value.getFullYear();
    setMode("months");
    setViewYear(y);
    setDecadeStart(Math.floor(y / DECADE_SIZE) * DECADE_SIZE);
    setHighlight(value.getMonth());
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => gridRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, mode]);

  const today = new Date();
  const count = mode === "months" ? 12 : DECADE_SIZE;

  const commit = (index: number) => {
    if (mode === "months") {
      onChange(new Date(viewYear, index, 1));
      setOpen(false);
    } else {
      const y = decadeStart + index;
      setViewYear(y);
      setMode("months");
      setHighlight(value.getFullYear() === y ? value.getMonth() : 0);
    }
  };

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setHighlight((h) => Math.min(count - 1, h + 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(count - 1, h + GRID_COLS));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - GRID_COLS));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(highlight);
    }
  };

  const stepYear = (delta: number) => {
    if (mode === "months") setViewYear((y) => y + delta);
    else setDecadeStart((d) => d + delta * DECADE_SIZE);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={openPicker}
        className="flex items-center gap-1 rounded px-2 py-1 text-[13px] font-medium text-white/70 hover:bg-white/5 hover:text-white"
      >
        {value.toLocaleDateString([], { month: "long", year: "numeric" })}
        <ChevronDown size={13} className="text-white/40" />
      </button>
      <PortalPopover
        open={open}
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        className="w-56 overflow-hidden rounded-md border border-clide-border bg-clide-panel p-3 shadow-xl"
      >
        <div className="flex items-center justify-between pb-2">
          <button
            onClick={() => stepYear(-1)}
            className="flex h-6 w-6 items-center justify-center rounded text-white/50 hover:bg-white/5 hover:text-white"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => {
              if (mode === "months") {
                setMode("years");
                setDecadeStart(Math.floor(viewYear / DECADE_SIZE) * DECADE_SIZE);
                setHighlight(viewYear - Math.floor(viewYear / DECADE_SIZE) * DECADE_SIZE);
              }
            }}
            className="text-[13px] font-medium text-white hover:underline"
          >
            {mode === "months" ? viewYear : `${decadeStart}–${decadeStart + DECADE_SIZE - 1}`}
          </button>
          <button
            onClick={() => stepYear(1)}
            className="flex h-6 w-6 items-center justify-center rounded text-white/50 hover:bg-white/5 hover:text-white"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <div
          ref={gridRef}
          tabIndex={0}
          onKeyDown={onGridKeyDown}
          className="grid grid-cols-4 gap-1 outline-none"
        >
          {Array.from({ length: count }, (_, i) => {
            const isCurrent =
              mode === "months"
                ? viewYear === today.getFullYear() && i === today.getMonth()
                : decadeStart + i === today.getFullYear();
            const isSelected =
              mode === "months"
                ? viewYear === value.getFullYear() && i === value.getMonth()
                : decadeStart + i === value.getFullYear();
            const isHighlighted = highlight === i;
            return (
              <button
                key={i}
                onClick={() => commit(i)}
                onMouseEnter={() => setHighlight(i)}
                className={`rounded px-2 py-1.5 text-center text-[12px] ${
                  isSelected
                    ? "bg-white/20 font-medium text-white"
                    : isHighlighted
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                } ${isCurrent && !isSelected ? "ring-1 ring-inset ring-white/20" : ""}`}
              >
                {mode === "months" ? MONTH_ABBR[i] : decadeStart + i}
              </button>
            );
          })}
        </div>
      </PortalPopover>
    </>
  );
}
