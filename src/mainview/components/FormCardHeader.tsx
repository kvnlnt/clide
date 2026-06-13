import { ExternalLink, Undo2 } from "lucide-react";
import type { FormDefinition, FormMeta } from "../types/forms";
import EllipsisMenu from "./EllipsisMenu";

interface FormCardHeaderProps {
  meta: FormMeta;
  form: FormDefinition;
  aiPrompt: string;
  onAiPromptChange: (v: string) => void;
  disabled?: boolean;
  pinned: boolean;
  onPin: () => void;
  onSchedule: () => void;
  onRerun: () => void;
  onDelete: () => void;
  onUndo: () => void;
}

export default function FormCardHeader({
  meta,
  form,
  aiPrompt,
  onAiPromptChange,
  disabled,
  pinned,
  onPin,
  onSchedule,
  onRerun,
  onDelete,
  onUndo,
}: FormCardHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-[12px] font-medium text-white">{meta.name}</span>

      {form.aiPromptField && (
        <input
          className="flex-1 bg-transparent text-[12px] italic text-white outline-none placeholder:text-white/30"
          placeholder="✦ Describe your post..."
          value={aiPrompt}
          disabled={disabled}
          onChange={(e) => onAiPromptChange(e.target.value)}
        />
      )}
      {!form.aiPromptField && <div className="flex-1" />}

      <div className="flex items-center gap-3">
        <button className="text-white/40 transition-colors hover:text-white">
          <ExternalLink size={16} />
        </button>
        <button className="text-white/40 transition-colors hover:text-white" onClick={onUndo}>
          <Undo2 size={16} />
        </button>
        <EllipsisMenu pinned={pinned} onPin={onPin} onSchedule={onSchedule} onRerun={onRerun} onDelete={onDelete} />
      </div>
    </div>
  );
}
