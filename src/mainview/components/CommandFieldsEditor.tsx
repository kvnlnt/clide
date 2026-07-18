import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { describeFieldMapping } from "../types/tasks";
import type { ArgMapping, ArgMappingKind, FieldType, TaskField, ToolSpec } from "../types/tasks";

const FIELD_TYPES: FieldType[] = ["text", "textarea", "select", "multicheck", "number", "file", "date"];
const TYPE_HINT: Record<FieldType, string> = {
  text: "single-line text box",
  textarea: "multi-line text box",
  select: "dropdown — one choice",
  multicheck: "checkboxes — several choices",
  number: "number box",
  file: "file path picker",
  date: "date picker",
};

const MAPPING_KINDS: ArgMappingKind[] = ["option", "flag", "positional", "env", "stdin"];
const MAPPING_PLAIN: Record<ArgMappingKind, string> = {
  option: "Passed as --flag <value>",
  flag: "Adds a flag when checked",
  positional: "Passed as a bare argument",
  env: "Set as an environment variable",
  stdin: "Typed content is piped into the tool",
};

const inputBase =
  "w-full rounded border border-clide-border bg-clide-surface text-white text-[13px] px-2.5 py-1.5 outline-none placeholder:text-white/30 focus:border-white/30";
const fieldLabel = "text-[12px] font-medium text-white/60";
const fieldHint = "text-[11px] text-white/30";

/** Title-cases a flag token into a label suggestion: `--output-dir` → "Output dir". */
function labelFromFlag(flag: string): string {
  const bare = flag.replace(/^-+/, "").replace(/[-_]+/g, " ").trim();
  return bare ? bare.charAt(0).toUpperCase() + bare.slice(1) : "";
}

/** Input-type inference from an option's help text — only ever applied to fresh fields. */
function inferType(description: string): FieldType | null {
  if (/\b(file|path|directory|folder)\b/i.test(description)) return "file";
  if (/\b(number|count|pixels?|seconds?|width|height|size|port|amount)\b/i.test(description)) return "number";
  return null;
}

interface Props {
  fields: TaskField[];
  onChange: (fields: TaskField[]) => void;
  /** The chosen tool's distilled spec — powers the pick-a-real-option mapping flow (ticket 65). */
  toolSpec?: ToolSpec;
  /** Lifted open-card state so the live preview can highlight/open cards (ticket 66). */
  openId: string | null;
  onOpenChange: (id: string | null) => void;
}

/**
 * CRUD editor for a command-backed form's input fields (tickets 61/64/65):
 * one labeled card per field — title, summary, and a body where every
 * control says what it does. Mapping leads with the tool's real options
 * from its spec, phrased in plain language, with a Custom escape hatch.
 */
export default function CommandFieldsEditor({ fields, onChange, toolSpec, openId, onOpenChange }: Props) {
  const update = (index: number, partial: Partial<TaskField>) => {
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
    // New fields default to optional (ticket 61) — required is opt-in.
    const field: TaskField = { id, label: "", type: "text", argMapping: { kind: "option", flag: `--${id}` } };
    onChange([...fields, field]);
    onOpenChange(id);
  };

  // Two fields mapping the same flag usually means a mistake — flag it (ticket 65).
  const flagCounts = new Map<string, number>();
  for (const f of fields) {
    const m = f.argMapping;
    if (m && (m.kind === "option" || m.kind === "flag") && m.flag) {
      flagCounts.set(m.flag, (flagCounts.get(m.flag) ?? 0) + 1);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wider text-white/30">Fields</label>
      <div className="flex flex-col gap-1.5">
        {fields.length === 0 && <div className="text-[13px] text-white/30">No fields — the form is a button.</div>}
        {fields.map((field, i) => (
          <FieldCard
            key={field.id}
            field={field}
            toolSpec={toolSpec}
            open={openId === field.id}
            duplicateFlag={
              field.argMapping?.flag !== undefined && (flagCounts.get(field.argMapping.flag) ?? 0) > 1
            }
            onToggle={() => onOpenChange(openId === field.id ? null : field.id)}
            onCollapse={() => onOpenChange(null)}
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

function FieldCard({
  field,
  toolSpec,
  open,
  duplicateFlag,
  onToggle,
  onCollapse,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  field: TaskField;
  toolSpec?: ToolSpec;
  open: boolean;
  duplicateFlag: boolean;
  onToggle: () => void;
  onCollapse: () => void;
  onUpdate: (partial: Partial<TaskField>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const untitled = field.label.trim() === "";
  const summary = [
    field.type,
    field.required ? "required" : "optional",
    describeFieldMapping(field),
  ].join(" · ");

  const iconBtn =
    "flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/30 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent";

  return (
    <div className={`rounded-lg border bg-white/[0.02] ${untitled ? "border-amber-400/30" : "border-white/5"}`}>
      {/* Header — the whole strip toggles; reorder/delete stay usable collapsed. */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {open ? (
            <ChevronDown size={13} className="shrink-0 text-white/30" />
          ) : (
            <ChevronRight size={13} className="shrink-0 text-white/30" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {untitled ? (
                <span className="flex items-center gap-1 text-[13px] italic text-amber-300/80">
                  <AlertTriangle size={11} /> Untitled field
                </span>
              ) : (
                <span className="truncate text-[13px] font-medium text-white">{field.label}</span>
              )}
            </div>
            <span className="block truncate font-mono text-[11px] text-white/35">{summary}</span>
          </div>
        </button>
        <button onClick={onMoveUp} disabled={!onMoveUp} className={iconBtn} title="Move up">
          <ArrowUp size={13} />
        </button>
        <button onClick={onMoveDown} disabled={!onMoveDown} className={iconBtn} title="Move down">
          <ArrowDown size={13} />
        </button>
        <button onClick={onRemove} className={`${iconBtn} hover:text-red-400`} title="Delete field">
          <Trash2 size={13} />
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-3 border-t border-white/5 px-3.5 py-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className={fieldLabel}>Label</label>
              <input
                autoFocus={untitled}
                className={inputBase}
                placeholder="e.g. Output width"
                value={field.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onCollapse();
                  if (e.key === "Escape") {
                    // Escape here means "collapse the card", not "close the
                    // wizard" — stop it reaching the window-level handler.
                    e.stopPropagation();
                    onCollapse();
                  }
                }}
              />
              <span className={fieldHint}>Shown as the field's title on the form</span>
            </div>
            <div className="flex flex-col gap-1">
              <label className={fieldLabel}>Input type</label>
              <select
                className={`${inputBase} appearance-none`}
                value={field.type}
                onChange={(e) => onUpdate({ type: e.target.value as FieldType })}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-clide-panel">
                    {t} — {TYPE_HINT[t]}
                  </option>
                ))}
              </select>
              <span className={fieldHint}>What the person filling the form will see</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className={fieldLabel}>Help text</label>
            <input
              className={inputBase}
              placeholder="e.g. Width of the output image, in pixels"
              value={field.description ?? ""}
              onChange={(e) => onUpdate({ description: e.target.value || undefined })}
            />
            <span className={fieldHint}>Tells the person filling the form what to enter</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className={fieldLabel}>Placeholder</label>
              <input
                className={inputBase}
                placeholder="Ghost text shown inside the empty input"
                value={field.placeholder ?? ""}
                onChange={(e) => onUpdate({ placeholder: e.target.value || undefined })}
              />
            </div>
            <div className="flex flex-col justify-end gap-1 pb-0.5">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-white/70">
                <input
                  type="checkbox"
                  checked={field.required === true}
                  onChange={(e) => onUpdate({ required: e.target.checked })}
                />
                Required
              </label>
              <span className={fieldHint}>The form can't be submitted without it</span>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-white/70">
                <input
                  type="checkbox"
                  checked={field.secret === true}
                  onChange={(e) => onUpdate({ secret: e.target.checked || undefined })}
                />
                Secret
              </label>
              <span className={fieldHint}>Value is masked before it reaches any AI</span>
            </div>
          </div>

          {(field.type === "select" || field.type === "multicheck") && (
            <div className="flex flex-col gap-1">
              <label className={fieldLabel}>Options</label>
              <input
                className={inputBase}
                placeholder="Comma-separated, e.g. small, medium, large"
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
              <span className={fieldHint}>The choices offered by the dropdown / checkboxes</span>
            </div>
          )}

          <MappingSection field={field} toolSpec={toolSpec} duplicateFlag={duplicateFlag} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// "On the command line" — spec-first, plain-language mapping (ticket 65).
// ---------------------------------------------------------------------------

function MappingSection({
  field,
  toolSpec,
  duplicateFlag,
  onUpdate,
}: {
  field: TaskField;
  toolSpec?: ToolSpec;
  duplicateFlag: boolean;
  onUpdate: (partial: Partial<TaskField>) => void;
}) {
  const mapping: ArgMapping = field.argMapping ?? { kind: "option" };
  const [advancedOpen, setAdvancedOpen] = useState(false);
  /** Sticks the section on manual controls after an explicit "Custom…" pick. */
  const [forceCustom, setForceCustom] = useState(false);

  const updateMapping = (next: ArgMapping) => onUpdate({ argMapping: next });

  const options = toolSpec?.options ?? [];
  const positionals = toolSpec?.positionals ?? [];
  const hasSpecChoices = options.length > 0 || positionals.length > 0;

  // Derive which spec entry the current mapping corresponds to, if any.
  let specValue = "custom";
  if (!forceCustom) {
    if ((mapping.kind === "option" || mapping.kind === "flag") && mapping.flag) {
      const idx = options.findIndex((o) => o.flags.includes(mapping.flag!));
      if (idx >= 0) specValue = `opt:${idx}`;
    } else if (mapping.kind === "positional" && mapping.order !== undefined && mapping.order < positionals.length) {
      specValue = `pos:${mapping.order}`;
    }
  }

  const pickSpecEntry = (value: string) => {
    setForceCustom(false);
    if (value === "custom") {
      setForceCustom(true);
      return;
    }
    const fresh = field.label.trim() === "";
    const [kind, idxStr] = value.split(":");
    const idx = Number(idxStr);
    if (kind === "opt") {
      const opt = options[idx];
      if (!opt) return;
      const longFlag = [...opt.flags].sort((a, b) => b.length - a.length)[0]!;
      const patch: Partial<TaskField> = {
        argMapping: opt.takesValue
          ? { kind: "option", flag: longFlag, style: "space", repeat: opt.repeatable === true }
          : { kind: "flag", flag: longFlag },
      };
      if (fresh) {
        patch.label = labelFromFlag(longFlag);
        if (opt.description) patch.description = opt.description;
        const inferred = inferType(opt.description);
        if (inferred) patch.type = inferred;
        else if (!opt.takesValue) patch.type = "text"; // flags render as a checkbox via the boolean value; keep type simple
      }
      onUpdate(patch);
    } else {
      const pos = positionals[idx];
      if (!pos) return;
      const patch: Partial<TaskField> = { argMapping: { kind: "positional", order: idx } };
      if (fresh) {
        patch.label = labelFromFlag(pos.name);
        if (pos.description) patch.description = pos.description;
        const inferred = inferType(`${pos.name} ${pos.description}`);
        if (inferred) patch.type = inferred;
      }
      onUpdate(patch);
    }
  };

  const showCustom = !hasSpecChoices || specValue === "custom";

  return (
    <div className="flex flex-col gap-2 rounded-md border border-white/5 bg-white/[0.02] p-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-white/30">On the command line</div>

      {hasSpecChoices && (
        <div className="flex flex-col gap-1">
          <label className={fieldLabel}>This field fills…</label>
          <select className={`${inputBase} appearance-none`} value={specValue} onChange={(e) => pickSpecEntry(e.target.value)}>
            {options.map((o, i) => (
              <option key={`opt:${i}`} value={`opt:${i}`} className="bg-clide-panel">
                {o.flags.join(", ")}
                {o.description ? ` — ${o.description}` : ""}
              </option>
            ))}
            {positionals.map((p, i) => (
              <option key={`pos:${i}`} value={`pos:${i}`} className="bg-clide-panel">
                {p.name} (bare argument){p.description ? ` — ${p.description}` : ""}
              </option>
            ))}
            <option value="custom" className="bg-clide-panel">
              Custom…
            </option>
          </select>
          <span className={fieldHint}>The tool's real options, from its documentation</span>
        </div>
      )}

      {showCustom && (
        <>
          <div className="flex flex-col gap-1">
            <label className={fieldLabel}>How it's passed</label>
            <select
              className={`${inputBase} appearance-none`}
              value={mapping.kind}
              onChange={(e) => {
                const kind = e.target.value as ArgMappingKind;
                updateMapping({ ...mapping, kind });
              }}
            >
              {MAPPING_KINDS.map((k) => (
                <option key={k} value={k} className="bg-clide-panel">
                  {MAPPING_PLAIN[k]}
                </option>
              ))}
            </select>
          </div>

          {(mapping.kind === "flag" || mapping.kind === "option") && (
            <div className="flex flex-col gap-1">
              <label className={fieldLabel}>Flag</label>
              <input
                className={`${inputBase} font-mono`}
                placeholder={`--${field.id}`}
                value={mapping.flag ?? ""}
                onChange={(e) => updateMapping({ ...mapping, flag: e.target.value || undefined })}
              />
            </div>
          )}

          {mapping.kind === "positional" && (
            <div className="flex flex-col gap-1">
              <label className={fieldLabel}>Position</label>
              <input
                type="number"
                className={`${inputBase} w-28`}
                placeholder="0"
                value={mapping.order ?? ""}
                onChange={(e) => updateMapping({ ...mapping, order: e.target.value ? Number(e.target.value) : undefined })}
              />
              <span className={fieldHint}>Order among the bare arguments, lowest first</span>
            </div>
          )}

          {mapping.kind === "env" && (
            <div className="flex flex-col gap-1">
              <label className={fieldLabel}>Variable name</label>
              <input
                className={`${inputBase} font-mono`}
                placeholder={field.id.toUpperCase()}
                value={mapping.envName ?? ""}
                onChange={(e) => updateMapping({ ...mapping, envName: e.target.value || undefined })}
              />
            </div>
          )}
        </>
      )}

      {mapping.kind === "option" && (
        <>
          <button
            onClick={() => setAdvancedOpen((o) => !o)}
            className="flex items-center gap-1 self-start text-[11px] font-medium text-white/40 hover:text-white/70"
          >
            {advancedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Advanced
          </button>
          {advancedOpen && (
            <div className="flex items-center gap-3">
              <select
                className={`${inputBase} w-40 appearance-none`}
                value={mapping.style ?? "space"}
                onChange={(e) => updateMapping({ ...mapping, style: e.target.value as "space" | "equals" })}
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
                  onChange={(e) => updateMapping({ ...mapping, repeat: e.target.checked })}
                />
                Repeat flag per value
              </label>
            </div>
          )}
        </>
      )}

      {/* Always-visible result: change anything above, watch this update. */}
      <div className="flex items-center justify-between rounded bg-clide-bg px-2.5 py-1.5">
        <span className={fieldHint}>Result</span>
        <span className="min-w-0 truncate font-mono text-[12px] text-white/70">{describeFieldMapping(field)}</span>
      </div>

      {duplicateFlag && (
        <span className="flex items-center gap-1 text-[11px] text-amber-300/80">
          <AlertTriangle size={11} /> Another field already uses this flag — usually a mistake.
        </span>
      )}
    </div>
  );
}
