import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { useState } from "react";
import type { ArgMappingKind, FieldType, FormField } from "../types/forms";

const FIELD_TYPES: FieldType[] = ["text", "textarea", "select", "multicheck", "number", "file", "date"];
const MAPPING_KINDS: ArgMappingKind[] = ["option", "flag", "positional", "env", "stdin"];
const MAPPING_LABEL: Record<ArgMappingKind, string> = {
  option: "Option (--flag value)",
  flag: "Flag (present/absent)",
  positional: "Positional",
  env: "Environment variable",
  stdin: "Piped to stdin",
};

const inputBase =
  "w-full rounded border border-clide-border bg-clide-surface text-white text-[13px] px-2.5 py-1.5 outline-none placeholder:text-white/30 focus:border-white/30";

interface Props {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}

/** Per-field editor for a command-backed form: field basics plus how the value maps onto the tool's argv (ticket 54). */
export default function CommandFieldsEditor({ fields, onChange }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const update = (index: number, partial: Partial<FormField>) => {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...partial } : f)));
  };

  const remove = (index: number) => onChange(fields.filter((_, i) => i !== index));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const add = () => {
    let n = fields.length + 1;
    let id = `field-${n}`;
    while (fields.some((f) => f.id === id)) id = `field-${++n}`;
    const field: FormField = { id, label: "", type: "text", argMapping: { kind: "option", flag: `--${id}` } };
    onChange([...fields, field]);
    setExpandedId(id);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wider text-white/30">Fields</label>
      <div className="flex flex-col gap-1">
        {fields.length === 0 && <div className="text-[13px] text-white/30">No fields — the form is a button.</div>}
        {fields.map((field, i) => (
          <FieldRow
            key={field.id}
            field={field}
            expanded={expandedId === field.id}
            onToggle={() => setExpandedId(expandedId === field.id ? null : field.id)}
            onUpdate={(partial) => update(i, partial)}
            onRemove={() => remove(i)}
            onMoveUp={i > 0 ? () => move(i, -1) : undefined}
            onMoveDown={i < fields.length - 1 ? () => move(i, 1) : undefined}
          />
        ))}
      </div>
      <button
        onClick={add}
        className="flex items-center gap-1.5 self-start rounded px-1.5 py-1 text-[12px] text-white/40 hover:bg-white/5 hover:text-white"
      >
        <Plus size={13} /> Add field
      </button>
    </div>
  );
}

function FieldRow({
  field,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  field: FormField;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (partial: Partial<FormField>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const mapping = field.argMapping ?? { kind: "option" as ArgMappingKind };
  const updateMapping = (partial: Partial<NonNullable<FormField["argMapping"]>>) =>
    onUpdate({ argMapping: { ...mapping, ...partial } });

  const iconBtn =
    "flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/30 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent";

  return (
    <div className="rounded border border-white/5 bg-white/[0.02]">
      <div className="flex items-center gap-1.5 px-1.5 py-1.5">
        <button onClick={onToggle} className={iconBtn} title={expanded ? "Collapse" : "Expand"}>
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <input
          className={`${inputBase} flex-1`}
          placeholder="Label"
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
        />
        <select
          className={`${inputBase} w-[104px] shrink-0 appearance-none`}
          value={field.type}
          onChange={(e) => onUpdate({ type: e.target.value as FieldType })}
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t} className="bg-clide-panel">
              {t}
            </option>
          ))}
        </select>
        <button
          onClick={() => onUpdate({ required: !field.required })}
          className={`shrink-0 rounded px-1.5 py-1 text-[11px] font-bold ${
            field.required ? "bg-white/10 text-white" : "text-white/30 hover:bg-white/5 hover:text-white/60"
          }`}
          title="Required"
        >
          REQ
        </button>
        <button onClick={onMoveUp} disabled={!onMoveUp} className={iconBtn} title="Move up">
          <ArrowUp size={13} />
        </button>
        <button onClick={onMoveDown} disabled={!onMoveDown} className={iconBtn} title="Move down">
          <ArrowDown size={13} />
        </button>
        <button onClick={onRemove} className={iconBtn} title="Remove">
          <X size={13} />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-white/5 px-3 py-2.5">
          {(field.type === "select" || field.type === "multicheck") && (
            <input
              className={inputBase}
              placeholder="Options, comma-separated"
              value={(field.options ?? []).join(", ")}
              onChange={(e) =>
                onUpdate({
                  options: e.target.value
                    .split(",")
                    .map((o) => o.trim())
                    .filter(Boolean),
                })
              }
            />
          )}

          <div className="flex flex-col gap-2 rounded border border-white/5 bg-white/[0.02] p-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/30">Maps to</div>
            <select
              className={`${inputBase} appearance-none`}
              value={mapping.kind}
              onChange={(e) => updateMapping({ kind: e.target.value as ArgMappingKind })}
            >
              {MAPPING_KINDS.map((k) => (
                <option key={k} value={k} className="bg-clide-panel">
                  {MAPPING_LABEL[k]}
                </option>
              ))}
            </select>

            {(mapping.kind === "flag" || mapping.kind === "option") && (
              <input
                className={inputBase}
                placeholder={`--${field.id}`}
                value={mapping.flag ?? ""}
                onChange={(e) => updateMapping({ flag: e.target.value || undefined })}
              />
            )}

            {mapping.kind === "option" && (
              <div className="flex items-center gap-3">
                <select
                  className={`${inputBase} w-32 appearance-none`}
                  value={mapping.style ?? "space"}
                  onChange={(e) => updateMapping({ style: e.target.value as "space" | "equals" })}
                >
                  <option value="space" className="bg-clide-panel">
                    --flag value
                  </option>
                  <option value="equals" className="bg-clide-panel">
                    --flag=value
                  </option>
                </select>
                <label className="flex items-center gap-1.5 text-[12px] text-white/60">
                  <input
                    type="checkbox"
                    checked={mapping.repeat === true}
                    onChange={(e) => updateMapping({ repeat: e.target.checked })}
                  />
                  Repeat flag per value
                </label>
              </div>
            )}

            {mapping.kind === "positional" && (
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  className={`${inputBase} w-24`}
                  placeholder="Order"
                  value={mapping.order ?? ""}
                  onChange={(e) => updateMapping({ order: e.target.value ? Number(e.target.value) : undefined })}
                />
                <label className="flex items-center gap-1.5 text-[12px] text-white/60">
                  <input
                    type="checkbox"
                    checked={mapping.repeat === true}
                    onChange={(e) => updateMapping({ repeat: e.target.checked })}
                  />
                  Multiple values
                </label>
              </div>
            )}

            {mapping.kind === "env" && (
              <input
                className={inputBase}
                placeholder={field.id.toUpperCase()}
                value={mapping.envName ?? ""}
                onChange={(e) => updateMapping({ envName: e.target.value || undefined })}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
