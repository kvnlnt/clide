import { EyeOff, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import type { RunStatus, ThreadView, ThreadViewFilters } from "../types/forms";

const STATUS_OPTIONS: RunStatus[] = ["idle", "running", "success", "error", "scheduled"];

interface Props {
  view: ThreadView;
  /** A just-created (unsaved) view: Cancel/Delete discards it entirely. */
  isNew: boolean;
  /** "modal" overlays the pane for editing an existing view; "page" fills the
   *  pane body while creating a new view. */
  variant: "modal" | "page";
}

/**
 * Combined view editor: name + filters plus the view actions (hide / delete)
 * that used to live in a separate tab dropdown. Rendered as a centered modal
 * for an existing view, or as the pane's body content for a brand-new view.
 */
export default function ViewEditor({ view, isNew, variant }: Props) {
  const {
    forms,
    activeProject,
    activeViewId,
    updateView,
    deleteView,
    setActiveView,
    commitNewView,
    discardNewView,
    editView,
  } = useApp();

  const [name, setName] = useState(view.name);
  const [formSlugs, setFormSlugs] = useState<string[]>(view.filters.formSlugs ?? []);
  const [statuses, setStatuses] = useState<RunStatus[]>(view.filters.statuses ?? []);
  const [query, setQuery] = useState(view.filters.query ?? "");
  const [formQuery, setFormQuery] = useState("");

  const projectForms = forms.filter((f) => f.meta.project === activeProject);

  const nameFor = (slug: string) => projectForms.find((f) => f.meta.slug === slug)?.meta.name ?? slug;

  // Live-filtered suggestions: unselected project forms matching the query,
  // capped so hundreds of forms stay manageable.
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

  const addForm = (slug: string) => {
    setFormSlugs((cur) => (cur.includes(slug) ? cur : [...cur, slug]));
    setFormQuery("");
  };

  const toggle = <T,>(list: T[], item: T): T[] =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  /** Dismiss the editor without persisting a change. */
  const close = () => {
    if (variant === "modal") editView(null);
  };

  const save = () => {
    const filters: ThreadViewFilters = {};
    if (formSlugs.length > 0) filters.formSlugs = formSlugs;
    if (statuses.length > 0) filters.statuses = statuses;
    if (query.trim()) filters.query = query.trim();
    const updated: ThreadView = { ...view, name: name.trim() || view.name, filters };
    if (isNew) commitNewView(updated);
    else {
      updateView(updated);
      close();
    }
  };

  const cancel = () => {
    if (isNew) discardNewView();
    else close();
  };

  const hide = () => {
    updateView({ ...view, hidden: true });
    if (view.id === activeViewId) setActiveView(null);
    close();
  };

  const remove = () => {
    if (isNew) discardNewView();
    else {
      deleteView(view.id);
      close();
    }
  };

  const sectionLabel = "mb-1 block text-[11px] uppercase tracking-wide text-white/30";
  const checkboxRow = "flex cursor-pointer items-center gap-2 text-sm text-white/70 hover:text-white";

  const body = (
    <div
      className="flex flex-col gap-3 text-left"
      onKeyDown={(e) => {
        if (e.key === "Escape") cancel();
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") save();
      }}
    >
      <div>
        <label className={sectionLabel}>Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-clide-border bg-clide-bg px-2 py-1 text-sm text-white outline-none focus:border-white/30"
        />
      </div>

      <div>
        <label className={sectionLabel}>Forms</label>
        {projectForms.length === 0 ? (
          <div className="text-sm italic text-white/30">No forms in this project</div>
        ) : (
          <>
            {formSlugs.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {formSlugs.map((slug) => (
                  <span
                    key={slug}
                    className="flex max-w-full items-center gap-1 rounded-full bg-white/10 py-0.5 pl-2 pr-1 text-[12px] text-white/80"
                  >
                    <span className="truncate">{nameFor(slug)}</span>
                    <button
                      onClick={() => setFormSlugs((cur) => cur.filter((s) => s !== slug))}
                      title="Remove"
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              value={formQuery}
              onChange={(e) => setFormQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions[0]) {
                  e.preventDefault();
                  e.stopPropagation();
                  addForm(suggestions[0].meta.slug);
                }
              }}
              placeholder={formSlugs.length === 0 ? "All forms — type to narrow…" : "Add another form…"}
              className="w-full rounded border border-clide-border bg-clide-bg px-2 py-1 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/30"
            />
            <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto">
              {suggestions.length === 0 && formQuery.trim() !== "" && (
                <div className="px-1 py-0.5 text-[12px] italic text-white/30">No forms match “{formQuery}”</div>
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
          </>
        )}
      </div>

      <div>
        <label className={sectionLabel}>Status</label>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {STATUS_OPTIONS.map((s) => (
            <label key={s} className={checkboxRow}>
              <input
                type="checkbox"
                checked={statuses.includes(s)}
                onChange={() => setStatuses((cur) => toggle(cur, s))}
              />
              {s}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className={sectionLabel}>Text query</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Match form name or inputs"
          className="w-full rounded border border-clide-border bg-clide-bg px-2 py-1 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/30"
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        {!isNew && (
          <>
            <button
              onClick={hide}
              title="Hide this tab (unhide from the project menu)"
              className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-white/50 transition-colors hover:bg-white/5 hover:text-white"
            >
              <EyeOff size={13} /> Hide
            </button>
            <button
              onClick={remove}
              title="Delete this view"
              className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 size={13} /> Delete
            </button>
          </>
        )}
        <div className="flex-1" />
        <button onClick={cancel} className="rounded px-3 py-1 text-sm text-white/50 transition-colors hover:text-white">
          Cancel
        </button>
        <button
          onClick={save}
          className="rounded bg-white/10 px-3 py-1 text-sm text-white transition-colors hover:bg-white/20"
        >
          Save
        </button>
      </div>
    </div>
  );

  if (variant === "modal") {
    return (
      <div className="absolute inset-0 z-30 flex items-start justify-center bg-black/50 pt-16" onMouseDown={cancel}>
        <div
          className="w-80 rounded-lg border border-clide-border bg-clide-panel p-4 shadow-2xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {body}
        </div>
      </div>
    );
  }

  return (
    <div className="clide-scroll flex flex-1 justify-center overflow-y-auto p-6">
      <div className="h-fit w-full max-w-[420px] rounded-lg border border-clide-border bg-clide-panel p-4">
        <div className="mb-3 text-[13px] font-bold text-white">New view</div>
        {body}
      </div>
    </div>
  );
}
