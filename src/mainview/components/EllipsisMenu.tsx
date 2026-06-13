import { Ellipsis } from "lucide-react";
import { useState } from "react";
import FormCardMenu from "./FormCardMenu";

interface EllipsisMenuProps {
  pinned: boolean;
  onPin: () => void;
  onSchedule: () => void;
  onRerun: () => void;
  onDelete: () => void;
  size?: number;
}

export default function EllipsisMenu({ pinned, onPin, onSchedule, onRerun, onDelete, size = 16 }: EllipsisMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        className="text-white/40 transition-colors hover:text-white"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <Ellipsis size={size} />
      </button>
      {open && (
        <FormCardMenu
          pinned={pinned}
          onPin={onPin}
          onSchedule={onSchedule}
          onRerun={onRerun}
          onDelete={onDelete}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
