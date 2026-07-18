import { AlarmClock, Pin, RotateCw, Trash2 } from "lucide-react";

interface FormCardMenuProps {
  pinned: boolean;
  /** Pinning only has meaning inside saved views — hidden on the title tab. */
  showPin?: boolean;
  onPin: () => void;
  onSchedule: () => void;
  onRerun: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function FormCardMenu({
  pinned,
  showPin = true,
  onPin,
  onSchedule,
  onRerun,
  onDelete,
  onClose,
}: FormCardMenuProps) {
  const item = "flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-white/80 hover:bg-white/5 text-left";

  return (
    <div>
      {showPin && (
        <button
          className={item}
          onClick={() => {
            onPin();
            onClose();
          }}
        >
          <Pin size={14} /> {pinned ? "Unpin" : "Pin"}
        </button>
      )}
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
