import { AlertTriangle, Copy } from "lucide-react";
import { copyToClipboard } from "../clipboard";

interface DependencyWarningProps {
  dependency: string;
  installInstructions?: string;
  onRetry: () => void;
  onSkip: () => void;
}

export default function DependencyWarning({
  dependency,
  installInstructions,
  onRetry,
  onSkip,
}: DependencyWarningProps) {
  return (
    <div className="rounded border border-orange-500/40 bg-orange-500/5 p-3">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-orange-300">
        <AlertTriangle size={15} />
        Missing dependency: {dependency}
      </div>
      {installInstructions && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded bg-clide-bg px-2 py-1.5 font-mono text-[12px] text-white/80">
          <span className="truncate">{installInstructions}</span>
          <button
            className="shrink-0 text-white/40 hover:text-white"
            title="Copy"
            onClick={() => void copyToClipboard(installInstructions)}
          >
            <Copy size={13} />
          </button>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button className="rounded px-3 py-1 text-[12px] text-white/60 hover:text-white" onClick={onSkip}>
          Skip
        </button>
        <button
          className="rounded border border-white/10 bg-clide-panel px-3 py-1 text-[12px] font-bold text-white/70 hover:text-white"
          onClick={onRetry}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
