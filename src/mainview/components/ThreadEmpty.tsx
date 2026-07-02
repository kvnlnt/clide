import { Search, Sparkles } from "lucide-react";
import { useApp } from "../context/AppContext";

/**
 * Empty-thread state. When a filter view is active it explains the empty
 * result; otherwise it invites the user to create or open a form.
 */
export default function ThreadEmpty({ filtered = false }: { filtered?: boolean }) {
  const { openNewForm, openPanel } = useApp();

  if (filtered) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="text-[16px] italic text-white/30">✦ No runs match this view</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-white/10 px-12 py-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
          <Sparkles size={24} className="text-white/50" />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[17px] font-semibold text-white/80">Nothing here yet</h2>
          <p className="max-w-[300px] text-[13px] leading-relaxed text-white/40">
            Forms are small scripts with a friendly face. Create one with AI, or open one you already have.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openNewForm}
            className="flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/20"
          >
            <Sparkles size={14} />
            Create a form
          </button>
          <button
            onClick={() => openPanel("forms")}
            className="flex items-center gap-2 rounded-md border border-white/10 px-4 py-2 text-[13px] font-medium text-white/60 transition-colors hover:border-white/20 hover:text-white"
          >
            <Search size={14} />
            Browse forms
          </button>
        </div>
        <div className="text-[12px] text-white/25">
          or press{" "}
          <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-sans text-white/50">⌘P</kbd>{" "}
          anytime
        </div>
      </div>
    </div>
  );
}
