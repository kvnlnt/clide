import { ChevronDown, ChevronUp, Copy, ExternalLink } from "lucide-react";

interface OutputToolbarProps {
  label: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onCopy?: () => void;
  onOpenExternal?: () => void;
}

export default function OutputToolbar({ label, expanded, onToggleExpand, onCopy, onOpenExternal }: OutputToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-clide-border px-3 py-1.5">
      <span className="text-[11px] uppercase tracking-wide text-clide-muted">{label}</span>
      <div className="flex items-center gap-2 text-white/40">
        {onCopy && (
          <button className="hover:text-white" onClick={onCopy} title="Copy">
            <Copy size={14} />
          </button>
        )}
        {onOpenExternal && (
          <button className="hover:text-white" onClick={onOpenExternal} title="Open externally">
            <ExternalLink size={14} />
          </button>
        )}
        <button className="hover:text-white" onClick={onToggleExpand} title={expanded ? "Collapse" : "Expand"}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
    </div>
  );
}
