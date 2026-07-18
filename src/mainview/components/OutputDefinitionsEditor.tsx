import { AlertTriangle, ChevronDown, ChevronRight, FlaskConical, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { evaluateOutputs } from "../types/forms";
import type {
  Extraction,
  ExtractionSelector,
  OutputDefinition,
  OutputTransform,
  OutputType,
} from "../types/forms";

const OUTPUT_KINDS: OutputType[] = ["text", "table", "json", "image", "audio", "video"];

const inputBase =
  "w-full rounded border border-clide-border bg-clide-surface text-white text-[13px] px-2.5 py-1.5 outline-none placeholder:text-white/30 focus:border-white/30";
const fieldLabel = "text-[12px] font-medium text-white/60";
const fieldHint = "text-[11px] text-white/30";

type SelectorType = ExtractionSelector["type"];
const SELECTOR_LABEL: Record<SelectorType, string> = {
  whole: "everything",
  lines: "lines N–M",
  regex: "the part matching a pattern",
  jsonPath: "the JSON value at a path",
  lastPathLine: "the last printed file path",
};

const TRANSFORM_LABEL: Record<OutputTransform["type"], string> = {
  pickKeys: "pick & rename JSON keys",
  template: "format into a text template",
  parseNumber: "parse as a number",
  trim: "trim whitespace",
};

interface Props {
  outputs: OutputDefinition[];
  onChange: (outputs: OutputDefinition[]) => void;
}

/**
 * Wizard step-4 outputs editor (ticket 78): the raw output is always
 * captured; each definition here EXTRACTS a named piece of it. Extraction is
 * designed by watching it work — the live test box below runs the exact
 * evaluator the runner uses.
 */
export default function OutputDefinitionsEditor({ outputs, onChange }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [sample, setSample] = useState("");

  const add = () => {
    const id = crypto.randomUUID();
    onChange([
      ...outputs,
      { id, name: "", kind: "text", extraction: { source: "stdout", selector: { type: "whole" } } },
    ]);
    setOpenId(id);
  };

  const update = (id: string, patch: Partial<OutputDefinition>) =>
    onChange(outputs.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const remove = (id: string) => onChange(outputs.filter((o) => o.id !== id));

  const nameCounts = new Map<string, number>();
  for (const o of outputs) {
    const key = o.name.trim().toLowerCase();
    if (key) nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }

  // Live test (ticket 78): same evaluator as the runner — no fs check here,
  // so file-source values show their resolved path.
  const testResults = useMemo(() => {
    if (outputs.length === 0) return [];
    return evaluateOutputs(outputs, { stdout: sample, stderr: "" });
  }, [outputs, sample]);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] text-white/40">
        The command's raw output is always captured. Add outputs to extract specific pieces from it — each becomes
        a named result you can use later.
      </span>

      <div className="flex flex-col gap-1.5">
        {outputs.map((def) => (
          <DefinitionCard
            key={def.id}
            def={def}
            open={openId === def.id}
            duplicateName={(nameCounts.get(def.name.trim().toLowerCase()) ?? 0) > 1}
            onToggle={() => setOpenId(openId === def.id ? null : def.id)}
            onUpdate={(patch) => update(def.id, patch)}
            onRemove={() => remove(def.id)}
          />
        ))}
      </div>
      <button
        onClick={add}
        className="flex items-center gap-1.5 self-start rounded px-1.5 py-1 text-[12px] text-white/40 hover:bg-white/5 hover:text-white"
      >
        <Plus size={13} /> Add output
      </button>

      {outputs.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-clide-border bg-clide-surface p-3">
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-white/70">
            <FlaskConical size={13} className="text-white/40" />
            Test against sample output
          </div>
          <textarea
            className={`${inputBase} min-h-[80px] resize-y font-mono text-[12px]`}
            placeholder="Paste what the command might print, and watch each output extract from it…"
            value={sample}
            onChange={(e) => setSample(e.target.value)}
          />
          {sample.trim() === "" ? (
            <span className={fieldHint}>Running against empty input — paste a sample to see real extraction.</span>
          ) : null}
          <div className="flex flex-col gap-1">
            {testResults.map((res) => (
              <div key={res.id} className="flex items-baseline gap-2 text-[12px]">
                <span className="w-32 shrink-0 truncate font-medium text-white/60">{res.name || "(unnamed)"}</span>
                {res.ok ? (
                  <span className="min-w-0 break-all font-mono text-green-300/80">
                    {typeof res.value === "string" ? res.value : JSON.stringify(res.value)}
                  </span>
                ) : (
                  <span className="text-amber-300/80">{res.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DefinitionCard({
  def,
  open,
  duplicateName,
  onToggle,
  onUpdate,
  onRemove,
}: {
  def: OutputDefinition;
  open: boolean;
  duplicateName: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<OutputDefinition>) => void;
  onRemove: () => void;
}) {
  const untitled = def.name.trim() === "";
  const sel = def.extraction.selector;

  const setExtraction = (patch: Partial<Extraction>) => onUpdate({ extraction: { ...def.extraction, ...patch } });
  const setSelector = (selector: ExtractionSelector) => setExtraction({ selector });

  const setSelectorType = (type: SelectorType) => {
    switch (type) {
      case "whole":
        return setSelector({ type: "whole" });
      case "lines":
        return setSelector({ type: "lines", from: 1, to: undefined });
      case "regex":
        return setSelector({ type: "regex", pattern: "", group: undefined });
      case "jsonPath":
        return setSelector({ type: "jsonPath", path: "" });
      case "lastPathLine":
        return setSelector({ type: "lastPathLine" });
    }
  };

  const transforms = def.transforms ?? [];
  const addTransform = (type: OutputTransform["type"]) => {
    const t: OutputTransform =
      type === "pickKeys"
        ? { type, mapping: {} }
        : type === "template"
          ? { type, template: "{{value}}" }
          : { type };
    onUpdate({ transforms: [...transforms, t] });
  };
  const updateTransform = (index: number, t: OutputTransform) =>
    onUpdate({ transforms: transforms.map((x, i) => (i === index ? t : x)) });
  const removeTransform = (index: number) => {
    const next = transforms.filter((_, i) => i !== index);
    onUpdate({ transforms: next.length > 0 ? next : undefined });
  };

  const summary = `${def.kind} · from ${def.extraction.source} · ${SELECTOR_LABEL[sel.type]}`;

  return (
    <div className={`rounded-lg border bg-white/[0.02] ${untitled ? "border-amber-400/30" : "border-white/5"}`}>
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
                  <AlertTriangle size={11} /> Unnamed output
                </span>
              ) : (
                <span className="truncate text-[13px] font-medium text-white">{def.name}</span>
              )}
              {duplicateName && !untitled && (
                <span className="text-[11px] text-amber-300/80" title="Another output has this name">
                  duplicate name
                </span>
              )}
            </div>
            <span className="block truncate font-mono text-[11px] text-white/35">{summary}</span>
          </div>
        </button>
        <button
          onClick={onRemove}
          title="Delete output"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/30 hover:bg-white/10 hover:text-red-400"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-3 border-t border-white/5 px-3.5 py-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className={fieldLabel}>Name</label>
              <input
                autoFocus={untitled}
                className={inputBase}
                placeholder="e.g. Upload URL"
                value={def.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
              />
              <span className={fieldHint}>How this result is labeled — and addressed by workflows</span>
            </div>
            <div className="flex flex-col gap-1">
              <label className={fieldLabel}>Kind</label>
              <select
                className={`${inputBase} appearance-none`}
                value={def.kind}
                onChange={(e) => onUpdate({ kind: e.target.value as OutputType })}
              >
                {OUTPUT_KINDS.map((k) => (
                  <option key={k} value={k} className="bg-clide-panel">
                    {k}
                  </option>
                ))}
              </select>
              <span className={fieldHint}>How the extracted value is rendered</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className={fieldLabel}>Read from</label>
              <select
                className={`${inputBase} appearance-none`}
                value={def.extraction.source}
                onChange={(e) => setExtraction({ source: e.target.value as Extraction["source"] })}
              >
                <option value="stdout" className="bg-clide-panel">
                  command output (stdout)
                </option>
                <option value="stderr" className="bg-clide-panel">
                  error output (stderr)
                </option>
                <option value="file" className="bg-clide-panel">
                  a file the command names
                </option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={fieldLabel}>Take</label>
              <select
                className={`${inputBase} appearance-none`}
                value={sel.type}
                onChange={(e) => setSelectorType(e.target.value as SelectorType)}
              >
                {(Object.keys(SELECTOR_LABEL) as SelectorType[]).map((t) => (
                  <option key={t} value={t} className="bg-clide-panel">
                    {SELECTOR_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {sel.type === "regex" && (
            <div className="grid grid-cols-[1fr,120px] gap-3">
              <div className="flex flex-col gap-1">
                <label className={fieldLabel}>Pattern</label>
                <input
                  className={`${inputBase} font-mono`}
                  placeholder="e.g. url: (\\S+)"
                  value={sel.pattern}
                  onChange={(e) => setSelector({ ...sel, pattern: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className={fieldLabel}>Group</label>
                <input
                  type="number"
                  className={inputBase}
                  placeholder="1"
                  value={sel.group ?? ""}
                  onChange={(e) => setSelector({ ...sel, group: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
            </div>
          )}

          {sel.type === "jsonPath" && (
            <div className="flex flex-col gap-1">
              <label className={fieldLabel}>JSON path</label>
              <input
                className={`${inputBase} font-mono`}
                placeholder="e.g. items.0.url"
                value={sel.path}
                onChange={(e) => setSelector({ ...sel, path: e.target.value })}
              />
              <span className={fieldHint}>Dot-path into the parsed JSON output</span>
            </div>
          )}

          {sel.type === "lines" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={fieldLabel}>From line</label>
                <input
                  type="number"
                  className={inputBase}
                  value={sel.from ?? ""}
                  onChange={(e) => setSelector({ ...sel, from: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className={fieldLabel}>To line</label>
                <input
                  type="number"
                  className={inputBase}
                  placeholder="end"
                  value={sel.to ?? ""}
                  onChange={(e) => setSelector({ ...sel, to: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
            </div>
          )}

          {/* Then: optional light transforms, applied in order. */}
          <div className="flex flex-col gap-1.5">
            <label className={fieldLabel}>Then</label>
            {transforms.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-44 shrink-0 text-[12px] text-white/50">{TRANSFORM_LABEL[t.type]}</span>
                {t.type === "template" && (
                  <input
                    className={`${inputBase} font-mono`}
                    placeholder="Result: {{value}}"
                    value={t.template}
                    onChange={(e) => updateTransform(i, { type: "template", template: e.target.value })}
                  />
                )}
                {t.type === "pickKeys" && (
                  <input
                    className={`${inputBase} font-mono`}
                    placeholder="from:to, other_key:renamed"
                    value={Object.entries(t.mapping)
                      .map(([k, v]) => `${k}:${v}`)
                      .join(", ")}
                    onChange={(e) => {
                      const mapping: Record<string, string> = {};
                      for (const pair of e.target.value.split(",")) {
                        const [from, to] = pair.split(":").map((s) => s.trim());
                        if (from) mapping[from] = to || from;
                      }
                      updateTransform(i, { type: "pickKeys", mapping });
                    }}
                  />
                )}
                <button
                  onClick={() => removeTransform(i)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/30 hover:bg-white/10 hover:text-white"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <select
              className={`${inputBase} w-64 appearance-none text-white/50`}
              value=""
              onChange={(e) => {
                if (e.target.value) addTransform(e.target.value as OutputTransform["type"]);
              }}
            >
              <option value="" className="bg-clide-panel">
                + add a transform…
              </option>
              {(Object.keys(TRANSFORM_LABEL) as OutputTransform["type"][]).map((t) => (
                <option key={t} value={t} className="bg-clide-panel">
                  {TRANSFORM_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
