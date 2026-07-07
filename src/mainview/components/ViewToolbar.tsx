import { EyeOff, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import type { RunStatus, ThreadView } from "../types/forms";
import MultiSelectDropdown from "./MultiSelectDropdown";
import Toolbar from "./Toolbar";

const STATUS_OPTIONS: RunStatus[] = ["idle", "running", "success", "error", "scheduled"];

type DropdownKey = "forms" | "status" | "keywords";

interface Props {
  view: ThreadView;
}

/**
 * Toolbar for an active view tab: fused visually to the tab above it. Every
 * control applies to the saved view immediately via `updateView` — no
 * Save/Cancel. Forms, status, and keywords are compact dropdown triggers
 * (MultiSelectDropdown) that expand to their full controls on click.
 */
export default function ViewToolbar({ view }: Props) {
  const { forms, activeProject, activeViewId, updateView, deleteView, setActiveView } = useApp();

  const [name, setName] = useState(view.name);
  const [editingName, setEditingName] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null);
  const [formQuery, setFormQuery] = useState("");
  const [keywordInput, setKeywordInput] = useState("");

  // Only resync local echo state when the active view itself changes.
  useEffect(() => {
    setName(view.name);
    setEditingName(false);
    setOpenDropdown(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.id]);

  const projectForms = forms.filter((f) => f.meta.project === activeProject);
  const formSlugs = view.filters.formSlugs ?? [];
  const statuses = view.filters.statuses ?? [];
  const keywords = view.filters.keywords ?? [];
  const keywordMode = view.filters.keywordMode ?? "or";

  const nameFor = (slug: string) => projectForms.find((f) => f.meta.slug === slug)?.meta.name ?? slug;

  const suggestions = useMemo(() => {
    const q = formQuery.trim().toLowerCase();
    return projectForms
      .filter(
        (f) =>
          !formSlugs.includes(f.meta.slug) &&
          (q === "" || f.meta.name.toLowerCase().includes(q) || f.meta.slug.includes(q)),
      )
      .slice(0, 8);
  }, [projectForms, formSlugs, formQuery]);

  const toggleDropdown = (key: DropdownKey) => setOpenDropdown((cur) => (cur === key ? null : key));

  const commitName = () => {
    setEditingName(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === view.name) {
      setName(view.name);
      return;
    }
    updateView({ ...view, name: trimmed });
  };

  const toggleStatus = (s: RunStatus) => {
    const next = statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s];
    const filters = { ...view.filters };
    if (next.length > 0) filters.statuses = next;
    else delete filters.statuses;
    updateView({ ...view, filters });
  };

  const addForm = (slug: string) => {
    updateView({ ...view, filters: { ...view.filters, formSlugs: [...formSlugs, slug] } });
    setFormQuery("");
  };

  const removeForm = (slug: string) => {
    const next = formSlugs.filter((s) => s !== slug);
    const filters = { ...view.filters };
    if (next.length > 0) filters.formSlugs = next;
    else delete filters.formSlugs;
    updateView({ ...view, filters });
  };

  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    setKeywordInput("");
    if (!trimmed || keywords.some((k) => k.toLowerCase() === trimmed.toLowerCase())) return;
    updateView({ ...view, filters: { ...view.filters, keywords: [...keywords, trimmed] } });
  };

  const removeKeyword = (k: string) => {
    const next = keywords.filter((x) => x !== k);
    const filters = { ...view.filters };
    if (next.length > 0) filters.keywords = next;
    else delete filters.keywords;
    updateView({ ...view, filters });
  };

  const setKeywordMode = (mode: "and" | "or") => {
    updateView({ ...view, filters: { ...view.filters, keywordMode: mode } });
  };

  const hide = () => {
    updateView({ ...view, hidden: true });
    if (view.id === activeViewId) setActiveView(null);
  };

  const remove = () => deleteView(view.id);

  const rowChip = "flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[12px] text-white/80";
  const popoverInput =
    "w-full rounded border border-clide-border bg-clide-bg px-2 py-1 text-[13px] text-white outline-none placeholder:text-white/20 focus:border-white/30";

  const pluralizeWord = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

  return (
    <Toolbar>
      {editingName ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitName();
            if (e.key === "Escape") {
              setName(view.name);
              setEditingName(false);
            }
          }}
          className="w-32 shrink-0 rounded border border-clide-border bg-clide-bg px-1.5 py-0.5 text-[13px] text-white outline-none focus:border-white/30"
        />
      ) : (
        <button
          onClick={() => setEditingName(true)}
          title="Rename view"
          className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[13px] font-medium text-white/80 hover:bg-white/5 hover:text-white"
        >
          <Pencil size={11} className="text-white/30" />
        </button>
      )}

      <div className="mx-1 h-4 w-px shrink-0 bg-white/10" />

      <MultiSelectDropdown
        label={formSlugs.length === 0 ? "Forms" : pluralizeWord(formSlugs.length, "form", "forms")}
        active={formSlugs.length > 0}
        open={openDropdown === "forms"}
        onToggle={() => toggleDropdown("forms")}
        onClose={() => setOpenDropdown(null)}
      >
        {formSlugs.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {formSlugs.map((slug) => (
              <span key={slug} className={rowChip}>
                <span className="max-w-[140px] truncate">{nameFor(slug)}</span>
                <button
                  onClick={() => removeForm(slug)}
                  title="Remove"
                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full hover:bg-white/10"
                >
                  <X size={9} />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          autoFocus
          value={formQuery}
          onChange={(e) => setFormQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && suggestions[0]) addForm(suggestions[0].meta.slug);
          }}
          placeholder="Search forms…"
          className={popoverInput}
        />
        <div className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
          {suggestions.length === 0 && (
            <div className="px-1 py-0.5 text-[12px] italic text-white/30">No forms match</div>
          )}
          {suggestions.map((f) => (
            <button
              key={f.meta.slug}
              onClick={() => addForm(f.meta.slug)}
              className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[13px] text-white/60 hover:bg-white/5 hover:text-white"
            >
              {f.meta.name}
            </button>
          ))}
        </div>
      </MultiSelectDropdown>

      <MultiSelectDropdown
        label={statuses.length === 0 ? "Status" : pluralizeWord(statuses.length, "status", "statuses")}
        active={statuses.length > 0}
        open={openDropdown === "status"}
        onToggle={() => toggleDropdown("status")}
        onClose={() => setOpenDropdown(null)}
      >
        <div className="flex flex-col gap-0.5">
          {STATUS_OPTIONS.map((s) => (
            <label
              key={s}
              className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] text-white/70 hover:bg-white/5 hover:text-white"
            >
              <input type="checkbox" checked={statuses.includes(s)} onChange={() => toggleStatus(s)} />
              {s}
            </label>
          ))}
        </div>
      </MultiSelectDropdown>

      <MultiSelectDropdown
        label={keywords.length === 0 ? "Keywords" : pluralizeWord(keywords.length, "keyword", "keywords")}
        active={keywords.length > 0}
        open={openDropdown === "keywords"}
        onToggle={() => toggleDropdown("keywords")}
        onClose={() => setOpenDropdown(null)}
      >
        {keywords.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {keywords.map((k) => (
              <span key={k} className={rowChip}>
                <span className="max-w-[140px] truncate">{k}</span>
                <button
                  onClick={() => removeKeyword(k)}
                  title="Remove"
                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full hover:bg-white/10"
                >
                  <X size={9} />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          autoFocus
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addKeyword();
            }
          }}
          placeholder="Type a keyword, press Enter…"
          className={popoverInput}
        />
        {keywords.length > 1 && (
          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-white/40">
            Match
            <button
              onClick={() => setKeywordMode("or")}
              className={`rounded px-1.5 py-0.5 ${keywordMode === "or" ? "bg-white/10 text-white" : "hover:text-white"}`}
            >
              any (OR)
            </button>
            <button
              onClick={() => setKeywordMode("and")}
              className={`rounded px-1.5 py-0.5 ${keywordMode === "and" ? "bg-white/10 text-white" : "hover:text-white"}`}
            >
              all (AND)
            </button>
          </div>
        )}
      </MultiSelectDropdown>

      <div className="flex-1" />

      <button
        onClick={hide}
        title="Hide this tab (unhide from the project toolbar)"
        className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[12px] text-white/40 hover:bg-white/5 hover:text-white"
      >
        <EyeOff size={12} />
      </button>
      <button
        onClick={remove}
        title="Delete this view"
        className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[12px] text-red-400/60 hover:bg-red-500/10 hover:text-red-400"
      >
        <Trash2 size={12} />
      </button>
    </Toolbar>
  );
}
