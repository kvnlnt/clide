import { AlertTriangle } from "lucide-react";
import TaskField from "./TaskField";
import type { TaskField as FieldDef } from "../types/tasks";

interface TaskPreviewProps {
  fields: FieldDef[];
  /** Wizard-local scratch values — typed here to see them materialize in the command preview; never persisted. */
  sampleValues: Record<string, unknown>;
  onSampleChange: (id: string, value: unknown) => void;
  /** The card currently open in the editor — highlighted here; clicking a preview field opens its card. */
  openId: string | null;
  onOpen: (id: string) => void;
}

/**
 * Step 3's "How it will look" pane (ticket 66): the fields rendered exactly
 * as the task card will show them — same `TaskField` controls, same
 * label/help-text markup as TaskCardBody — and interactive, so sample
 * values feed the featured command preview. Two views of one list: the
 * open editor card is ringed here, and clicking a field jumps to its card.
 */
export default function TaskPreview({ fields, sampleValues, onSampleChange, openId, onOpen }: TaskPreviewProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-bold uppercase tracking-wider text-white/30">How it will look</span>
      <div className="overflow-hidden rounded-lg border border-clide-border bg-clide-surface">
        {fields.length === 0 ? (
          <div className="px-5 py-3.5 text-[13px] text-white/40">No inputs — press SEND to run.</div>
        ) : (
          <div className="flex flex-col gap-4 px-5 py-3.5">
            {fields.map((field) => {
              const untitled = field.label.trim() === "";
              const active = openId === field.id;
              return (
                <div
                  key={field.id}
                  onClick={() => onOpen(field.id)}
                  className={`-mx-2 flex cursor-pointer flex-col gap-1.5 rounded-md px-2 py-1 transition-shadow ${
                    active ? "ring-1 ring-white/25" : "hover:ring-1 hover:ring-white/10"
                  }`}
                  title="Click to edit this field"
                >
                  <label className="flex items-center gap-1.5 text-[14px] font-bold text-white/70">
                    {untitled ? (
                      <span className="flex items-center gap-1 font-normal italic text-amber-300/80">
                        <AlertTriangle size={11} /> Untitled field
                      </span>
                    ) : (
                      field.label
                    )}
                    {field.required && <span className="text-red-400"> *</span>}
                  </label>
                  {field.description && <span className="text-[12px] text-white/40">{field.description}</span>}
                  <TaskField
                    field={field}
                    value={sampleValues[field.id]}
                    onChange={(v) => onSampleChange(field.id, v)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
      <span className="text-[11px] text-white/25">
        Interactive — values you type here fill the command preview above, and aren't saved.
      </span>
    </div>
  );
}
