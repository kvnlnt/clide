import { Copy, FolderOpen } from "lucide-react";

interface OutputToolbarProps {
  label: string;
  onCopy?: () => void;
  onReveal?: () => void;
}

export default function OutputToolbar({ label, onCopy, onReveal }: OutputToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-clide-border bg-clide-bg px-3 py-1.5">
      <span className="text-[11px] uppercase tracking-wide text-clide-muted">{label}</span>
      <div className="flex items-center gap-2 text-white/40">
        {onCopy && (
          <button className="hover:text-white" onClick={onCopy} title="Copy">
            <Copy size={14} />
          </button>
        )}
        {onReveal && (
          <button className="hover:text-white" onClick={onReveal} title="Reveal in Finder">
            <FolderOpen size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
