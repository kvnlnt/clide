import { FileOutput, Radio, Sparkles, Terminal, Zap } from "lucide-react";
import { useApp } from "../context/AppContext";
import { buildCommand, formatCommandPreview } from "../types/forms";
import type { FormDefinition, RunRecord } from "../types/forms";
import FormField from "./FormField";

interface FormCardBodyProps {
  form: FormDefinition;
  values: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
  disabled?: boolean;
  /** Field ids currently being magic-filled (shimmer state). */
  filling?: Set<string>;
  /** The magic fill attempt failed — show a small hint. */
  fillFailed?: boolean;
  /** Drives the flow info block below the fields (ticket 56) — trigger/artifacts, emits/listeners. */
  run?: RunRecord;
}

/** Live "what will run" line for command-backed forms (ticket 52) — recomputed from current values. */
function CommandPreview({ form, values }: { form: FormDefinition; values: Record<string, unknown> }) {
  if (!form.command) return null;
  const built = buildCommand(form, values);
  return (
    <div className="flex items-start gap-1.5 rounded-md border border-clide-border bg-clide-bg px-2.5 py-2 font-mono text-[12px] text-white/60">
      <Terminal size={13} className="mt-0.5 shrink-0 text-white/30" />
      <span className="min-w-0 break-all">{formatCommandPreview(built.tool, built.argv)}</span>
    </div>
  );
}

/**
 * Chain visibility (ticket 56): shows what a triggered run received (source
 * form + artifacts) and, for the current form, which events it emits and how
 * many other forms are wired to listen for them — makes dead wiring obvious.
 */
function FlowInfo({ form, run }: { form: FormDefinition; run?: RunRecord }) {
  const { forms, runs, formsBySlug } = useApp();
  const emits = form.events?.emits ?? [];
  const trigger = run?.triggeredBy;
  const artifacts = trigger?.artifacts ?? [];

  if (emits.length === 0 && !trigger) return null;

  const sourceRun = trigger ? runs.find((r) => r.id === trigger.sourceRunId) : undefined;
  const sourceName = sourceRun ? formsBySlug.get(sourceRun.formSlug)?.meta.name : undefined;

  return (
    <div className="flex flex-col gap-1.5 text-[12px] text-white/40">
      {trigger && (
        <div className="flex items-start gap-1.5">
          <Zap size={12} className="mt-0.5 shrink-0 text-amber-300/70" />
          <span>
            Triggered by <span className="text-white/60">{trigger.event}</span>
            {sourceName && <> from {sourceName}</>}
          </span>
        </div>
      )}
      {artifacts.length > 0 && (
        <div className="flex items-start gap-1.5">
          <FileOutput size={12} className="mt-0.5 shrink-0 text-white/30" />
          <div className="flex flex-col gap-0.5">
            {artifacts.map((a) => (
              <span key={a} className="break-all font-mono text-[11px] text-white/50">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}
      {emits.map((name) => {
        const listenerCount = forms.filter((f) => f.form.events?.listensFor?.includes(name)).length;
        return (
          <div key={name} className="flex items-center gap-1.5">
            <Radio size={12} className="shrink-0 text-white/30" />
            <span>
              emits <span className="text-white/60">{name}</span> → {listenerCount} listener
              {listenerCount === 1 ? "" : "s"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function FormCardBody({ form, values, onChange, disabled, filling, fillFailed, run }: FormCardBodyProps) {
  if (form.fields.length === 0) {
    return (
      <div className="flex flex-col gap-3 px-5 py-3.5">
        <div className="text-[13px] text-white/40">No inputs — press SEND to run.</div>
        <CommandPreview form={form} values={values} />
        <FlowInfo form={form} run={run} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 px-5 py-3.5">
      {fillFailed && (
        <div className="flex items-center gap-1.5 text-[11px] text-white/30">
          <Sparkles size={11} /> couldn't auto-fill — fill the fields manually
        </div>
      )}
      {form.fields.map((field) => {
        const isFilling = filling?.has(field.id) === true;
        return (
          <div key={field.id} className={`flex flex-col gap-1.5 ${isFilling ? "animate-pulse" : ""}`}>
            <label className="flex items-center gap-1.5 text-[14px] font-bold text-white/70">
              {field.label}
              {field.required && <span className="text-red-400"> *</span>}
              {field.magic && (
                <span
                  className={`flex items-center ${isFilling ? "text-amber-300" : "text-amber-300/50"}`}
                  title={`Magic fill: ${field.magic.prompt}`}
                >
                  <Sparkles size={12} />
                </span>
              )}
            </label>
            {field.description && <span className="text-[12px] text-white/40">{field.description}</span>}
            <FormField
              field={field}
              value={values[field.id]}
              onChange={(v) => onChange(field.id, v)}
              disabled={disabled || isFilling}
            />
          </div>
        );
      })}
      <CommandPreview form={form} values={values} />
      <FlowInfo form={form} run={run} />
    </div>
  );
}
