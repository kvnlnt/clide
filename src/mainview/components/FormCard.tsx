import { useMemo, useState } from "react";
import type { FormDefinition, FormMeta, RepeatInterval, RunRecord } from "../types/forms";
import FormCardBody from "./FormCardBody";
import FormCardCollapsed from "./FormCardCollapsed";
import FormCardFooter from "./FormCardFooter";
import FormCardHeader from "./FormCardHeader";
import ScheduleSubForm from "./ScheduleSubForm";

export interface FormCardProps {
  run: RunRecord;
  form: FormDefinition;
  meta: FormMeta;
  defaultExpanded?: boolean;
  onSubmit: (values: Record<string, unknown>) => void;
  onCancel: () => void;
  onSchedule: (values: Record<string, unknown>, scheduledAt: string, repeat: RepeatInterval) => void;
  onPin: () => void;
  onDelete: () => void;
  onRerun: () => void;
  onDismiss?: () => void;
}

function isFilled(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
}

function summarize(form: FormDefinition, inputs: Record<string, unknown>, run: RunRecord): string {
  if (run.status === "error") return inputs.__error ? String(inputs.__error) : "Failed";
  if (run.status === "scheduled" && run.scheduledAt) {
    return `Scheduled for ${new Date(run.scheduledAt).toLocaleString()}`;
  }
  const first = form.fields.find((f) => isFilled(inputs[f.id]));
  if (first) {
    const v = inputs[first.id];
    return Array.isArray(v) ? v.join(", ") : String(v);
  }
  return "";
}

export default function FormCard({
  run,
  form,
  meta,
  defaultExpanded,
  onSubmit,
  onCancel,
  onSchedule,
  onPin,
  onDelete,
  onRerun,
  onDismiss,
}: FormCardProps) {
  const editable = run.status === "idle";
  const running = run.status === "running" || run.status === "pending";

  const [values, setValues] = useState<Record<string, unknown>>(run.inputs);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded ?? (run.status === "idle" || running));

  const canSubmit = useMemo(
    () => form.fields.every((f) => !f.required || isFilled(values[f.id])),
    [form.fields, values],
  );

  const setValue = (id: string, value: unknown) => setValues((prev) => ({ ...prev, [id]: value }));

  const shouldExpand = run.status === "idle" || running ? true : expanded;

  if (!shouldExpand) {
    return (
      <FormCardCollapsed
        meta={meta}
        run={run}
        summary={summarize(form, run.inputs, run)}
        onExpand={() => setExpanded(true)}
        onPin={onPin}
        onSchedule={() => {
          setExpanded(true);
          setShowSchedule(true);
        }}
        onRerun={onRerun}
        onDelete={onDelete}
      />
    );
  }

  const submitPayload = () => ({
    ...values,
    ...(form.aiPromptField && aiPrompt ? { __aiPrompt: aiPrompt } : {}),
  });

  return (
    <div
      className={`overflow-hidden rounded-[5px] border bg-clide-surface ${
        running ? "animate-pulse border-white/20" : "border-clide-border"
      }`}
    >
      <FormCardHeader
        meta={meta}
        form={form}
        aiPrompt={aiPrompt}
        onAiPromptChange={setAiPrompt}
        disabled={!editable}
        pinned={run.pinned}
        onPin={onPin}
        onSchedule={() => setShowSchedule((s) => !s)}
        onRerun={onRerun}
        onDelete={onDelete}
        onUndo={() => {
          if (run.status === "idle" && onDismiss) onDismiss();
          else if (!editable) setExpanded(false);
        }}
      />
      <div className="h-px bg-clide-border" />
      <FormCardBody form={form} values={values} onChange={setValue} disabled={!editable} />

      {showSchedule && editable && (
        <div className="px-4 pb-2">
          <ScheduleSubForm
            onSchedule={(at, repeat) => {
              onSchedule(submitPayload(), at, repeat);
              setShowSchedule(false);
            }}
            onCancel={() => setShowSchedule(false)}
          />
        </div>
      )}

      {(editable || running) && (
        <>
          <div className="h-px bg-clide-border" />
          <FormCardFooter
            status={run.status}
            canSubmit={canSubmit}
            onSubmit={() => onSubmit(submitPayload())}
            onCancel={onCancel}
          />
        </>
      )}
    </div>
  );
}
