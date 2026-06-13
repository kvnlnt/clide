import { AlarmClock, Pin, RotateCw, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

interface FormCardMenuProps {
  pinned: boolean;
  onPin: () => void;
  onSchedule: () => void;
  onRerun: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function FormCardMenu({ pinned, onPin, onSchedule, onRerun, onDelete, onClose }: FormCardMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const item = "flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-white/80 hover:bg-white/5 text-left";

  return (
    <div
      ref={ref}
      className="absolute right-0 top-6 z-30 w-40 overflow-hidden rounded-md border border-clide-border bg-clide-panel py-1 shadow-xl"
    >
      <button
        className={item}
        onClick={() => {
          onPin();
          onClose();
        }}
      >
        <Pin size={14} /> {pinned ? "Unpin" : "Pin"}
      </button>
      <button
        className={item}
        onClick={() => {
          onSchedule();
          onClose();
        }}
      >
        <AlarmClock size={14} /> Schedule
      </button>
      <button
        className={item}
        onClick={() => {
          onRerun();
          onClose();
        }}
      >
        <RotateCw size={14} /> Re-run
      </button>
      <button
        className={`${item} text-red-400`}
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        <Trash2 size={14} /> Delete
      </button>
    </div>
  );
}
