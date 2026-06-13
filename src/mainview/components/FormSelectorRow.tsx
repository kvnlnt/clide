import type { FormFolder } from "../types/forms";

interface FormSelectorRowProps {
  form: FormFolder;
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
}

export default function FormSelectorRow({ form, active, onSelect, onHover }: FormSelectorRowProps) {
  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left ${
        active ? "bg-[rgba(86,86,86,0.3)]" : "hover:bg-white/5"
      }`}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-[14px] text-white">{form.meta.name}</span>
        <span className="text-[12px] text-clide-muted">{form.meta.project}</span>
      </div>
      {form.meta.description && <span className="truncate text-[12px] text-white/40">{form.meta.description}</span>}
    </button>
  );
}
