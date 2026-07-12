import { X } from "lucide-react";
import { useState } from "react";
import type { OutputSpec, OutputType } from "../types/forms";

const OUTPUT_KINDS: OutputType[] = ["text", "table", "image", "audio", "video", "json"];

const inputBase =
  "w-full rounded border border-clide-border bg-clide-surface text-white text-[13px] px-2.5 py-1.5 outline-none placeholder:text-white/30 focus:border-white/30";
const sectionLabel = "text-[11px] font-bold uppercase tracking-wider text-white/30";

/**
 * Output-kind toggles for the wizard's final step (ticket 62). "Effects"
 * authoring was retired with the script era; any `kind: "effect"` entries
 * already present (legacy forms, future edit flows) are passed through
 * untouched rather than dropped on save.
 */
export function OutputKindPicker({ outputs, onChange }: { outputs: OutputSpec[]; onChange: (outputs: OutputSpec[]) => void }) {
  const kinds = new Set(outputs.filter((o) => o.kind !== "effect").map((o) => o.kind));
  const passthrough = outputs.filter((o) => o.kind === "effect");

  const toggleKind = (kind: OutputType) => {
    const next = new Set(kinds);
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    onChange([...OUTPUT_KINDS.filter((k) => next.has(k)).map((kind) => ({ kind })), ...passthrough]);
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
    </div>
  );
}

/** Event-name tag editor (emits / listens-for), unchanged from the spec-era editor. */
export function TagEditor({
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
