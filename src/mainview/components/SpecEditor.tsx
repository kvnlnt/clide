import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import type { FieldType, FormField, FormSpecDraft, OutputSpec, OutputType } from "../types/forms";

const FIELD_TYPES: FieldType[] = ["text", "textarea", "select", "multicheck", "number", "file", "date"];
const OUTPUT_KINDS: OutputType[] = ["text", "table", "image", "audio", "video", "json"];

const inputBase =
  "w-full bg-[rgba(217,217,217,0.05)] text-white text-[13px] rounded px-2.5 py-1.5 outline-none placeholder:text-white/30";
const sectionLabel = "text-[11px] font-bold uppercase tracking-wider text-white/30";

interface SpecEditorProps {
  spec: FormSpecDraft;
  onChange: (spec: FormSpecDraft) => void;
}

/** Editable rendering of an AI-drafted form spec (wizard step 2). */
export default function SpecEditor({ spec, onChange }: SpecEditorProps) {
  const patch = (partial: Partial<FormSpecDraft>) => onChange({ ...spec, ...partial });

  return (
    <div className="flex flex-col gap-5">
      <InputsSection inputs={spec.inputs} onChange={(inputs) => patch({ inputs })} />

      <div className="flex flex-col gap-1.5">
        <label className={sectionLabel}>Procedure</label>
        <textarea
          className={`${inputBase} min-h-[96px] resize-y font-mono text-[12px]`}
          placeholder="1. Read the input file&#10;2. ..."
          value={spec.procedure}
          onChange={(e) => patch({ procedure: e.target.value })}
        />
      </div>

      <OutputsSection outputs={spec.outputs} onChange={(outputs) => patch({ outputs })} />

      <TagEditor
        label="Emits"
        hint="Events fired when a run succeeds — e.g. media:created"
        tags={spec.events.emits}
        onChange={(emits) => patch({ events: { ...spec.events, emits } })}
      />
      <TagEditor
        label="Listens for"
        hint="Events that auto-submit this form (wired in a later release)"
        tags={spec.events.listensFor}
        onChange={(listensFor) => patch({ events: { ...spec.events, listensFor } })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

function InputsSection({ inputs, onChange }: { inputs: FormField[]; onChange: (inputs: FormField[]) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const update = (index: number, partial: Partial<FormField>) => {
    onChange(inputs.map((f, i) => (i === index ? { ...f, ...partial } : f)));
  };

  const remove = (index: number) => onChange(inputs.filter((_, i) => i !== index));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= inputs.length) return;
    const next = [...inputs];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const add = () => {
    let n = inputs.length + 1;
    let id = `input-${n}`;
    while (inputs.some((f) => f.id === id)) id = `input-${++n}`;
    onChange([...inputs, { id, label: "", type: "text" }]);
    setExpandedId(id);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className={sectionLabel}>Inputs</label>
      <div className="flex flex-col gap-1">
        {inputs.length === 0 && <div className="text-[13px] text-white/30">No inputs — the form is a button.</div>}
        {inputs.map((field, i) => (
          <InputRow
            key={field.id}
            field={field}
            expanded={expandedId === field.id}
            onToggle={() => setExpandedId(expandedId === field.id ? null : field.id)}
            onUpdate={(partial) => update(i, partial)}
            onRemove={() => remove(i)}
            onMoveUp={i > 0 ? () => move(i, -1) : undefined}
            onMoveDown={i < inputs.length - 1 ? () => move(i, 1) : undefined}
          />
        ))}
      </div>
      <button
        onClick={add}
        className="flex items-center gap-1.5 self-start rounded px-1.5 py-1 text-[12px] text-white/40 hover:bg-white/5 hover:text-white"
      >
        <Plus size={13} /> Add input
      </button>
    </div>
  );
}

function InputRow({
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
  const magicOn = field.magic !== undefined;
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
        <button
          onClick={() => onUpdate({ magic: magicOn ? undefined : { prompt: "", source: "prompt" } })}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${
            magicOn ? "bg-white/10 text-amber-300" : "text-white/30 hover:bg-white/5 hover:text-white/60"
          }`}
          title="Magic auto-fill"
        >
          <Sparkles size={13} />
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
          <input
            className={inputBase}
            placeholder="Placeholder text"
            value={field.placeholder ?? ""}
            onChange={(e) => onUpdate({ placeholder: e.target.value || undefined })}
          />
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
          {magicOn && field.magic && (
            <div className="flex flex-col gap-2 rounded border border-amber-300/20 bg-amber-300/5 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300/70">
                <Sparkles size={11} /> Magic fill
              </div>
              <textarea
                className={`${inputBase} min-h-[48px] resize-y`}
                placeholder="Prompt used to fill this field, e.g. today's date in ISO format"
                value={field.magic.prompt}
                onChange={(e) => onUpdate({ magic: { ...field.magic!, prompt: e.target.value } })}
              />
              <select
                className={`${inputBase} appearance-none`}
                value={field.magic.source}
                onChange={(e) => onUpdate({ magic: { ...field.magic!, source: e.target.value as "prompt" | "event" } })}
              >
                <option value="prompt" className="bg-clide-panel">
                  Fill from prompt alone
                </option>
                <option value="event" className="bg-clide-panel">
                  Fill from triggering event payload
                </option>
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

function OutputsSection({ outputs, onChange }: { outputs: OutputSpec[]; onChange: (outputs: OutputSpec[]) => void }) {
  const kinds = new Set(outputs.filter((o) => o.kind !== "effect").map((o) => o.kind));
  const effects = outputs.filter((o) => o.kind === "effect");

  const rebuild = (nextKinds: Set<OutputSpec["kind"]>, nextEffects: OutputSpec[]) => {
    onChange([...OUTPUT_KINDS.filter((k) => nextKinds.has(k)).map((kind) => ({ kind })), ...nextEffects]);
  };

  const toggleKind = (kind: OutputType) => {
    const next = new Set(kinds);
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    rebuild(next, effects);
  };

  const updateEffect = (index: number, description: string) => {
    rebuild(
      kinds,
      effects.map((e, i) => (i === index ? { ...e, description } : e)),
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className={sectionLabel}>Outputs</label>
      <div className="flex flex-wrap gap-1.5">
        {OUTPUT_KINDS.map((kind) => (
          <button
            key={kind}
            onClick={() => toggleKind(kind)}
            className={`rounded px-2.5 py-1 text-[12px] ${
              kinds.has(kind)
                ? "bg-white/10 text-white ring-1 ring-white/20"
                : "text-white/40 ring-1 ring-white/10 hover:bg-white/5 hover:text-white/70"
            }`}
          >
            {kind}
          </button>
        ))}
      </div>
      {effects.map((effect, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-white/30">effect</span>
          <input
            className={`${inputBase} flex-1`}
            placeholder="Describe the side effect, e.g. updates the artifact index"
            value={effect.description ?? ""}
            onChange={(e) => updateEffect(i, e.target.value)}
          />
          <button
            onClick={() =>
              rebuild(
                kinds,
                effects.filter((_, j) => j !== i),
              )
            }
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/30 hover:bg-white/10 hover:text-white"
            title="Remove effect"
          >
            <X size={13} />
          </button>
        </div>
      ))}
      <button
        onClick={() => rebuild(kinds, [...effects, { kind: "effect", description: "" }])}
        className="flex items-center gap-1.5 self-start rounded px-1.5 py-1 text-[12px] text-white/40 hover:bg-white/5 hover:text-white"
      >
        <Plus size={13} /> Add effect
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event name tag editor
// ---------------------------------------------------------------------------

function TagEditor({
  label,
  hint,
  tags,
  onChange,
}: {
  label: string;
  hint: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const name = draft.trim().toLowerCase();
    setDraft("");
    if (!name || tags.includes(name)) return;
    onChange([...tags, name]);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className={sectionLabel}>{label}</label>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[12px] text-white/80">
            {tag}
            <button
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="text-white/40 hover:text-white"
              title="Remove"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          className={`${inputBase} w-40 flex-1`}
          placeholder="domain:verb ⏎"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
        />
      </div>
      <div className="text-[11px] text-white/25">{hint}</div>
    </div>
  );
}
