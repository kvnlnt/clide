import { ChevronDown } from "lucide-react";
import { useRef, type ReactNode } from "react";
import PortalPopover from "./PortalPopover";

interface Props {
  label: string;
  /** Whether the filter has an active selection — styles the trigger accordingly. */
  active: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Compact collapsed-summary trigger + popover body, shared by all toolbar
 * filters (forms / status / keywords) so they look and behave identically.
 * Open/close state is controlled by the caller so only one dropdown across a
 * toolbar can be open at a time.
 */
export default function MultiSelectDropdown({ label, active, open, onToggle, onClose, children }: Props) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <button
        ref={anchorRef}
        onClick={onToggle}
        className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] transition-colors ${
          active ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/5 hover:text-white"
        }`}
      >
        {label}
        <ChevronDown size={11} className="opacity-60" />
      </button>
      <PortalPopover
        open={open}
        anchorRef={anchorRef}
        onClose={onClose}
        className="w-64 overflow-hidden rounded-md border border-clide-border bg-clide-panel p-2 shadow-xl"
      >
        {children}
      </PortalPopover>
    </>
  );
}
