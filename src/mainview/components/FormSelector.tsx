import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { useFormSearch } from "../hooks/useFormSearch";
import FormSelectorRow from "./FormSelectorRow";

export default function FormSelector() {
  const { forms, recentSlugs, addFormDraft, addNewFormDraft, closeSelector, activeProject } = useApp();
  const projectForms = activeProject ? forms.filter((f) => f.meta.project === activeProject) : forms;
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useFormSearch(projectForms, query, recentSlugs);
  const createIndex = results.length; // "Create new form" sits after results.
  const total = results.length + 1;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const choose = (index: number) => {
    if (index === createIndex) {
      addNewFormDraft();
      return;
    }
    const form = results[index];
    if (form) addFormDraft(form.meta.slug);
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
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeSelector();
    }
  };

  return (
    <div
      className="absolute inset-0 z-40 flex items-start justify-center bg-black/40 pt-24"
      onMouseDown={closeSelector}
    >
      <div
        className="w-[480px] overflow-hidden rounded-lg border border-clide-border bg-clide-panel shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search forms…"
          className="w-full bg-clide-bg px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/30"
        />
        <div className="clide-scroll max-h-[340px] overflow-y-auto">
          {results.map((form, i) => (
            <FormSelectorRow
              key={form.meta.slug}
              form={form}
              active={active === i}
              onSelect={() => choose(i)}
              onHover={() => setActive(i)}
            />
          ))}
          <button
            onClick={() => choose(createIndex)}
            onMouseEnter={() => setActive(createIndex)}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] ${
              active === createIndex ? "bg-[rgba(86,86,86,0.3)]" : "hover:bg-white/5"
            }`}
          >
            <Sparkles size={15} className="text-white/60" />
            <span className="italic text-white/70">✦ Create new form...</span>
          </button>
        </div>
      </div>
    </div>
  );
}
