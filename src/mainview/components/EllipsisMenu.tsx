import { Ellipsis } from "lucide-react";
import { useRef, useState } from "react";
import PortalPopover from "./PortalPopover";
import TaskCardMenu from "./TaskCardMenu";

interface EllipsisMenuProps {
  pinned: boolean;
  showPin?: boolean;
  onPin: () => void;
  onSchedule: () => void;
  onRerun: () => void;
  onDelete: () => void;
  size?: number;
}

export default function EllipsisMenu({
  pinned,
  showPin,
  onPin,
  onSchedule,
  onRerun,
  onDelete,
  size = 16,
}: EllipsisMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={buttonRef}
        className="text-white/40 transition-colors hover:text-white"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <Ellipsis size={size} />
      </button>
      <PortalPopover
        open={open}
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        className="w-40 overflow-hidden rounded-md border border-clide-border bg-clide-panel py-1 shadow-xl"
      >
        <TaskCardMenu
          pinned={pinned}
          showPin={showPin}
          onPin={onPin}
          onSchedule={onSchedule}
          onRerun={onRerun}
          onDelete={onDelete}
          onClose={() => setOpen(false)}
        />
      </PortalPopover>
    </>
  );
}
