import { Sparkles } from "lucide-react";
import type { FormDefinition } from "../types/forms";
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
}

export default function FormCardBody({ form, values, onChange, disabled, filling, fillFailed }: FormCardBodyProps) {
  if (form.fields.length === 0) {
    return <div className="px-4 py-3 text-[13px] text-white/40">No inputs — press SEND to run.</div>;
  }
  return (
    <div className="flex flex-col gap-4 px-4 py-3">
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
            <FormField
              field={field}
              value={values[field.id]}
              onChange={(v) => onChange(field.id, v)}
              disabled={disabled || isFilling}
            />
          </div>
        );
      })}
    </div>
  );
}
