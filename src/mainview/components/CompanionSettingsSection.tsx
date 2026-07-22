import { Volume2, VolumeX } from "lucide-react";
import { useApp } from "../context/AppContext";

/** Ticket 138: the floating voice companion window's home in Settings — show/hide + mute. */
export default function CompanionSettingsSection() {
  const { companionEnabled, setCompanionEnabled, companionMuted, setCompanionMuted } = useApp();

  return (
    <div className="mt-6">
      <span className="text-[12px] font-bold uppercase tracking-wider text-white/40">Voice Companion</span>
      <div className="mt-2 text-[12px] text-white/30">
        A small floating window that greets you on launch and reads back run results — drag it anywhere, click to
        expand its transcript. Reuses the speech settings above for its voice.
      </div>

      <div className="mt-3 flex items-center justify-between rounded-md border border-clide-border px-3 py-2">
        <span className="text-[13px] text-white/70">Show companion window</span>
        <button
          type="button"
          role="switch"
          aria-checked={companionEnabled}
          onClick={() => setCompanionEnabled(!companionEnabled)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
            companionEnabled ? "bg-amber-400/70" : "bg-white/10"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              companionEnabled ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between rounded-md border border-clide-border px-3 py-2">
        <div className="flex items-center gap-2 text-[13px] text-white/70">
          {companionMuted ? <VolumeX size={14} className="text-white/40" /> : <Volume2 size={14} className="text-white/40" />}
          Talk-back
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!companionMuted}
          disabled={!companionEnabled}
          onClick={() => setCompanionMuted(!companionMuted)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
            !companionMuted ? "bg-amber-400/70" : "bg-white/10"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              !companionMuted ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {companionMuted && (
        <div className="mt-1 text-[11px] text-white/30">
          Muted — everything CLIDE would have said still appears as text in the companion's transcript.
        </div>
      )}
    </div>
  );
}
