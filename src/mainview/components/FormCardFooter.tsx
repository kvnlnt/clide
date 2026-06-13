import { ChevronRight, Loader, Wifi } from "lucide-react";
import type { RunStatus } from "../types/forms";

interface FormCardFooterProps {
  status: RunStatus;
  canSubmit: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function FormCardFooter({ status, canSubmit, onSubmit, onCancel }: FormCardFooterProps) {
  const running = status === "running" || status === "pending";

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2 text-white/40">
        <Wifi size={16} />
        <span className="text-[11px]">{running ? "Running…" : "Ready"}</span>
      </div>

      {running ? (
        <button
          onClick={onCancel}
          className="flex items-center gap-2 rounded-[3px] border border-white/5 bg-clide-panel px-3 py-1.5 text-[12px] font-bold text-white/70 transition-colors hover:text-white"
        >
          <Loader size={14} className="animate-spin" />
          Cancel
        </button>
      ) : (
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="flex items-center gap-2 rounded-[3px] border border-white/5 bg-clide-panel py-1.5 pl-3 text-[12px] font-bold text-white/70 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          SEND
          <span className="mx-1 h-4 w-px bg-white/10" />
          <ChevronRight size={16} className="mr-1.5" />
        </button>
      )}
    </div>
  );
}
