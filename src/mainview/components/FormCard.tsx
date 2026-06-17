import { useMemo, useState } from "react";
import type {
  FormDefinition,
  FormMeta,
  OutputChunk,
  OutputType,
  RepeatInterval,
  RunRecord,
} from "../types/forms";
import FormCardBody from "./FormCardBody";
import FormCardFooter from "./FormCardFooter";
import FormCardHeader from "./FormCardHeader";
import ScheduleSubForm from "./ScheduleSubForm";
import SubmissionAccordion from "./SubmissionAccordion";
import CodeOutput from "./output/CodeOutput";
import OutputBlock from "./output/OutputBlock";

export interface FormCardProps {
  /** All runs for this group, newest first. Single-run groups have length 1. */
  runs: RunRecord[];
  form: FormDefinition;
  meta: FormMeta;
  outputType?: OutputType;
  /** Keyed by run id — full chunks map passed down so accordion rows can slice. */
  chunks?: Record<string, OutputChunk[]>;
  defaultExpanded?: boolean;
  onSubmit: (values: Record<string, unknown>) => void;
  onCancel: () => void;
  onSchedule: (
    values: Record<string, unknown>,
    scheduledAt: string,
    repeat: RepeatInterval,
  ) => void;
  onPin: () => void;
  onDelete: (runId: string) => void;
  onRerun: () => void;
  onDismiss?: () => void;
}

function isFilled(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
}

function summarize(
  form: FormDefinition,
  inputs: Record<string, unknown>,
  run: RunRecord,
): string {
  if (run.status === "error")
    return inputs.__error ? String(inputs.__error) : "Failed";
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
  runs,
  form,
  meta,
  outputType,
  chunks = {},
  defaultExpanded,
  onSubmit,
  onCancel,
  onSchedule,
  onPin,
  onDelete,
  onRerun,
  onDismiss,
}: FormCardProps) {
  // The latest (newest) run drives the card-level state.
  const run = runs[0];
  const isGrouped = runs.length > 1;

  const editable = run.status === "idle";
  const running = run.status === "running" || run.status === "pending";
  const hasSubmittedTabs =
    run.status === "running" ||
    run.status === "pending" ||
    run.status === "success" ||
    run.status === "error";

  const [values, setValues] = useState<Record<string, unknown>>(run.inputs);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [expanded, setExpanded] = useState(
    defaultExpanded ?? (run.status === "idle" || running),
  );
  const [activeTab, setActiveTab] = useState<
    "results" | "submitted" | "code"
  >("results");

  const canSubmit = useMemo(
    () => form.fields.every((f) => !f.required || isFilled(values[f.id])),
    [form.fields, values],
  );

  const setValue = (id: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [id]: value }));

  const shouldExpand = run.status === "idle" || running ? true : expanded;
  const toggleable = !(run.status === "idle" || running);

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
        run={run}
        runCount={isGrouped ? runs.length : undefined}
        summary={summarize(form, run.inputs, run)}
        expanded={shouldExpand}
        onToggle={toggleable ? () => setExpanded((e) => !e) : undefined}
        aiPrompt={aiPrompt}
        onAiPromptChange={setAiPrompt}
        disabled={!editable}
        pinned={run.pinned}
        onPin={onPin}
        onSchedule={() => setShowSchedule((s) => !s)}
        onRerun={onRerun}
        onDelete={() => onDelete(run.id)}
        onUndo={() => {
          if (run.status === "idle" && onDismiss) onDismiss();
          else if (!editable) setExpanded(false);
        }}
        showTabs={hasSubmittedTabs || isGrouped}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {shouldExpand && (
        <>
          <div className="h-px bg-clide-border" />

          {isGrouped ? (
            activeTab === "code" ? (
              <div className="px-4 py-3">
                <CodeOutput formSlug={run.formSlug} />
              </div>
            ) : (
              // Grouped: show accordion — each run is independently expandable.
              <SubmissionAccordion
                runs={runs}
                form={form}
                outputType={outputType}
                chunks={chunks}
                activeTab={activeTab}
              />
            )
          ) : hasSubmittedTabs ? (
            // Single completed run: Results / Submitted / Code tabs.
            <>
              {activeTab === "results" ? (
                outputType ? (
                  <OutputBlock
                    runId={run.id}
                    outputType={outputType}
                    status={run.status}
                    chunks={chunks[run.id] ?? []}
                  />
                ) : (
                  <div className="px-4 py-3 text-[13px] text-white/40">
                    No results.
                  </div>
                )
              ) : activeTab === "code" ? (
                <div className="px-4 py-3">
                  <CodeOutput formSlug={run.formSlug} />
                </div>
              ) : (
                <FormCardBody
                  form={form}
                  values={run.inputs}
                  onChange={() => {}}
                  disabled
                />
              )}
            </>
          ) : (
            // Single idle run: editable form body.
            <FormCardBody
              form={form}
              values={values}
              onChange={setValue}
              disabled={!editable}
            />
          )}

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
        </>
      )}
    </div>
  );
}
