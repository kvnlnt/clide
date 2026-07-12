import { Plus, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { useFormSearch } from "../hooks/useFormSearch";
import Modal from "./Modal";

interface RunFormPickerProps {
  onClose: () => void;
}

/**
 * Compact command-palette for running a form without leaving the current
 * tab: pick a form and it drops in as a draft card in whatever thread is
 * showing (title tab or a view tab). Opened via the toolbar Run button or
 * ⌘K/Ctrl+K from anywhere a project is active.
 */
export default function RunFormPicker({ onClose }: RunFormPickerProps) {
  const { forms, recentSlugs, addFormDraft, activeProject, openNewForm } = useApp();
  const scopedForms = activeProject ? forms.filter((f) => f.meta.project === activeProject) : forms;
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useFormSearch(scopedForms, query, recentSlugs);
  const createIndex = results.length;
  const total = results.length + 1;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const choose = (index: number) => {
    if (index === createIndex) {
      onClose();
      openNewForm();
      return;
    }
    const form = results[index];
    if (form) {
      addFormDraft(form.meta.slug);
      onClose();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + total) % total);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(active);
    }
    // Escape is handled by Modal — window-level, focus-independent.
  };

  return (
    <Modal onClose={onClose} widthClassName="w-[480px]" backdropClassName="pt-24" panelClassName="overflow-hidden">
        <button
          onClick={() => choose(createIndex)}
          onMouseEnter={() => setActive(createIndex)}
          className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-[13px] ${
            active === createIndex ? "bg-[rgba(86,86,86,0.3)]" : "hover:bg-white/5"
          }`}
        >
          <Plus size={14} className="shrink-0 text-white/60" />
          <span className="italic text-white/70">Create new form...</span>
        </button>
        <div className="flex items-center gap-2 border-b border-clide-border px-3 py-2.5">
          <Search size={14} className="shrink-0 text-white/30" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Run a form…"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/30"
          />
        </div>
        <div className="clide-scroll max-h-80 overflow-y-auto p-1">
          {results.length === 0 && query.trim() !== "" && (
            <div className="px-3 py-2 text-[13px] italic text-white/30">No forms match “{query}”</div>
          )}
          {results.map((form, i) => (
            <button
              key={form.meta.slug}
              onClick={() => choose(i)}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-[13px] ${
                active === i ? "bg-[rgba(86,86,86,0.3)]" : "hover:bg-white/5"
              }`}
            >
              <span className="min-w-0 truncate text-white">{form.meta.name}</span>
              {form.meta.description && (
                <span className="min-w-0 shrink truncate text-[12px] text-white/40">{form.meta.description}</span>
              )}
            </button>
          ))}
        </div>
    </Modal>
  );
}
