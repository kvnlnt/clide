import { AudioWaveform, PanelLeft, Settings2 } from "lucide-react";
import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import { formatSpeechActivationShortcut, isSpeechRecognitionSupported, isSpeechSynthesisSupported } from "../speech";
import TrafficLights from "./TrafficLights";
import ViewTabs from "./ViewTabs";

/**
 * Ticket 123: entry point for speech mode. Ticket 137 makes the mic
 * push-to-talk — the button only arms/disarms the mode; a key press (the
 * configured `speechActivationKey`) opens each listen session, so the
 * button's "armed" (on, mic closed) and "listening" (mic open) states need
 * to read distinctly at a glance, not just via the title tooltip.
 */
function SpeechModeButton() {
  const { speechModeActive, speechListening, speechError, toggleSpeechMode, speechActivationKey } = useApp();
  const canListen = isSpeechRecognitionSupported();
  const canSpeak = isSpeechSynthesisSupported();
  const isMac = useMemo(() => /mac/i.test(navigator.platform || navigator.userAgent), []);
  const shortcut = formatSpeechActivationShortcut(speechActivationKey, isMac);

  const title = speechError
    ? speechError
    : !canListen && !canSpeak
      ? "Speech mode isn't supported in this environment"
      : !canListen
        ? "Speech mode (voice output only — voice input isn't supported here)"
        : speechModeActive
          ? speechListening
            ? `Listening… press ${shortcut} or click to stop`
            : `Speech mode armed — press ${shortcut} to talk`
          : `Turn on speech mode (push-to-talk: ${shortcut})`;

  return (
    <button
      onClick={toggleSpeechMode}
      disabled={!canListen && !canSpeak}
      title={title}
      className={`relative flex items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        speechModeActive ? "text-amber-300" : "text-white/30 hover:text-white"
      } ${speechModeActive && !speechListening ? "ring-1 ring-amber-300/40" : ""}`}
    >
      <AudioWaveform size={18} className={speechListening ? "animate-pulse" : ""} />
      {speechListening && (
        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-amber-300 clide-status-pulse" />
      )}
    </button>
  );
}

export default function WindowControls() {
  const { toggleSidebar, openAppSettings, activeProject } = useApp();
  return (
    <div className="window-controls flex justify-between w-full placeitems-center transition-colors rounded-[15px] cursor-move">
      <TrafficLights />
      <ViewTabs />
      {activeProject !== null && (
        <div className="flex shrink-0 items-center gap-3 px-1.5">
          <SpeechModeButton />
          <button
            onClick={openAppSettings}
            title="Settings"
            className="text-white/30 transition-colors hover:text-white flex items-center justify-center rounded-full"
          >
            <Settings2 size={18} />
          </button>
          <button
            onClick={toggleSidebar}
            title="Toggle sidebar"
            className="text-white/30 transition-colors hover:text-white flex items-center justify-center rounded-full"
          >
            <PanelLeft size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
