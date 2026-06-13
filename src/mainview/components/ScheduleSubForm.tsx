import { useState } from "react";
import type { RepeatInterval } from "../types/forms";

interface ScheduleSubFormProps {
  onSchedule: (scheduledAt: string, repeat: RepeatInterval) => void;
  onCancel: () => void;
}

export default function ScheduleSubForm({ onSchedule, onCancel }: ScheduleSubFormProps) {
  const [when, setWhen] = useState("");
  const [repeat, setRepeat] = useState<RepeatInterval>("none");

  const inputClass = "bg-[rgba(217,217,217,0.05)] text-white text-[13px] rounded px-2 py-1 outline-none";

  return (
    <div className="mt-3 rounded border border-clide-border bg-black/20 p-3">
      <div className="mb-2 text-[12px] font-bold uppercase text-clide-muted">Schedule run</div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[13px] text-white/70">
          Run at
          <input type="datetime-local" className={inputClass} value={when} onChange={(e) => setWhen(e.target.value)} />
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
          disabled={!when}
          className="rounded border border-white/10 bg-clide-panel px-3 py-1 text-[12px] font-bold text-white/70 disabled:opacity-40"
          onClick={() => when && onSchedule(new Date(when).toISOString(), repeat)}
        >
          Schedule
        </button>
      </div>
    </div>
  );
}
