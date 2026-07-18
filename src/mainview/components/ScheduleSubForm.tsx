import { useState } from "react";
import type { RepeatInterval } from "../types/tasks";

interface ScheduleSubFormProps {
  onSchedule: (scheduledAt: string, repeat: RepeatInterval) => void;
  onCancel: () => void;
}

function todayISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ScheduleSubForm({ onSchedule, onCancel }: ScheduleSubFormProps) {
  // Separate date + time inputs — a combined datetime-local control has been
  // unreliable in Electrobun's embedded WebKit view (no responsive native
  // picker), leaving the "Schedule" button permanently disabled.
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [repeat, setRepeat] = useState<RepeatInterval>("none");

  const inputClass =
    "rounded border border-clide-border bg-clide-bg text-white text-[13px] px-2 py-1 outline-none focus:border-white/30";

  const submit = () => {
    if (!date) return;
    const [h, m] = (time || "00:00").split(":").map(Number);
    const d = new Date(`${date}T00:00:00`);
    d.setHours(h ?? 0, m ?? 0, 0, 0);
    onSchedule(d.toISOString(), repeat);
  };

  return (
    <div className="mt-3 rounded border border-clide-border bg-clide-panel p-3">
      <div className="mb-2 text-[12px] font-bold uppercase text-clide-muted">Schedule run</div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[13px] text-white/70">
          Date
          <input
            type="date"
            className={inputClass}
            min={todayISODate()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-white/70">
          Time
          <input type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-white/70">
          Repeat
          <select className={inputClass} value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatInterval)}>
            <option value="none" className="bg-clide-panel">
              None
            </option>
            <option value="daily" className="bg-clide-panel">
              Daily
            </option>
            <option value="weekly" className="bg-clide-panel">
              Weekly
            </option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button className="rounded px-3 py-1 text-[12px] text-white/60 hover:text-white" onClick={onCancel}>
          Cancel
        </button>
        <button
          disabled={!date}
          className="rounded border border-white/10 bg-clide-panel px-3 py-1 text-[12px] font-bold text-white/70 disabled:opacity-40"
          onClick={submit}
        >
          Schedule
        </button>
      </div>
    </div>
  );
}
