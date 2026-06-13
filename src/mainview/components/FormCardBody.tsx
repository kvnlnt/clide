import type { FormDefinition } from "../types/forms";
import FormField from "./FormField";

interface FormCardBodyProps {
  form: FormDefinition;
  values: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
  disabled?: boolean;
}

export default function FormCardBody({ form, values, onChange, disabled }: FormCardBodyProps) {
  if (form.fields.length === 0) {
    return <div className="px-4 py-3 text-[13px] text-white/40">No inputs — press SEND to run.</div>;
  }
  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      {form.fields.map((field) => (
        <div key={field.id} className="flex flex-col gap-1.5">
          <label className="text-[14px] font-bold text-white/70">
            {field.label}
            {field.required && <span className="text-red-400"> *</span>}
          </label>
          <FormField
            field={field}
            value={values[field.id]}
            onChange={(v) => onChange(field.id, v)}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}
