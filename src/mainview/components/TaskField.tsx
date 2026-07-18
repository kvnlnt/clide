import type { TaskField as FieldDef } from "../types/tasks";

interface TaskFieldProps {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

const inputBase =
  "w-full rounded border border-clide-border bg-clide-surface text-white text-[13px] px-2.5 py-1.5 outline-none placeholder:text-white/30 focus:border-white/30 disabled:opacity-60";

export default function TaskField({ field, value, onChange, disabled }: TaskFieldProps) {
  switch (field.type) {
    case "textarea":
      return (
        <textarea
          className={`${inputBase} min-h-[72px] resize-y`}
          placeholder={field.placeholder}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "select":
      return (
        <select
          className={`${inputBase} appearance-none`}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt} className="bg-clide-panel">
              {opt}
            </option>
          ))}
        </select>
      );

    case "multicheck": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (opt: string) => {
        if (disabled) return;
        onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
      };
      return (
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {(field.options ?? []).map((opt) => {
            const checked = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                disabled={disabled}
                onClick={() => toggle(opt)}
                className="flex items-center gap-2 text-[13px] text-white/70"
              >
                <span
                  className={`h-3.5 w-3.5 rounded-[3px] border ${
                    checked ? "bg-white/80 border-white/80" : "bg-clide-surface border-clide-border"
                  }`}
                />
                {opt}
              </button>
            );
          })}
        </div>
      );
    }

    case "number":
      return (
        <input
          type="number"
          className={inputBase}
          placeholder={field.placeholder}
          value={typeof value === "number" || typeof value === "string" ? String(value) : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
      );

    case "date":
      return (
        <input
          type="date"
          className={inputBase}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "file":
      return (
        <input
          type="text"
          className={inputBase}
          placeholder={field.placeholder ?? "/path/to/file"}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    default:
      return (
        <input
          type="text"
          className={inputBase}
          placeholder={field.placeholder}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
