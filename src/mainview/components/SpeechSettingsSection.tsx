import { Loader, Mic, Volume2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import {
  formatSpeechActivationShortcut,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  loadVoicesWhenReady,
  speak,
  SPEECH_ACTIVATION_KEYS,
  startListening,
} from "../speech";

const SAMPLE_TEXT = "This is a sample of the selected voice.";

/** Ticket 137: Speech mode's home in Settings — support status, voice picker, test buttons, push-to-talk key. */
export default function SpeechSettingsSection() {
  const { speechVoiceURI, setSpeechVoiceURI, speechActivationKey, setSpeechActivationKey } = useApp();
  const canListen = isSpeechRecognitionSupported();
  const canSpeak = isSpeechSynthesisSupported();
  const isMac = useMemo(() => /mac/i.test(navigator.platform || navigator.userAgent), []);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => loadVoicesWhenReady(setVoices), []);

  const [testListening, setTestListening] = useState(false);
  const [testTranscript, setTestTranscript] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const runListenTest = () => {
    if (!canListen || testListening) return;
    setTestTranscript(null);
    setTestError(null);
    setTestListening(true);
    startListening(
      (transcript) => setTestTranscript(transcript),
      (message) => setTestError(message),
      () => setTestListening(false),
    );
  };

  const runSpeakTest = () => {
    if (!canSpeak) return;
    speak(SAMPLE_TEXT, speechVoiceURI);
  };

  return (
    <div className="mt-6">
      <span className="text-[12px] font-bold uppercase tracking-wider text-white/40">Speech</span>
      <div className="mt-2 text-[12px] text-white/30">
        Voice in and voice out for the ⌘K command surface (ticket 123). Recognized speech runs through the same
        command picker as typed input — never a conversational agent.
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center justify-between rounded-md border border-clide-border px-3 py-2">
          <div className="flex items-center gap-2 text-[13px] text-white/70">
            <Mic size={14} className="text-white/40" />
            Voice input (recognition)
          </div>
          {canListen ? (
            <span className="rounded-full bg-green-500/20 px-1.5 py-0.5 text-[10px] font-medium text-green-400">
              supported
            </span>
          ) : (
            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
              not supported here
            </span>
          )}
        </div>
        {!canListen && (
          <div className="text-[11px] text-white/30">
            This webview doesn't implement the SpeechRecognition API — commonly the case for Electrobun's
            WebKit-based view on macOS. Voice output still works below.
          </div>
        )}

        <div className="flex items-center justify-between rounded-md border border-clide-border px-3 py-2">
          <div className="flex items-center gap-2 text-[13px] text-white/70">
            <Volume2 size={14} className="text-white/40" />
            Voice output (synthesis)
          </div>
          {canSpeak ? (
            <span className="rounded-full bg-green-500/20 px-1.5 py-0.5 text-[10px] font-medium text-green-400">
              supported
            </span>
          ) : (
            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
              not supported here
            </span>
          )}
        </div>
      </div>

      {canSpeak && (
        <div className="mt-3 flex items-center gap-2">
          <select
            value={speechVoiceURI ?? ""}
            onChange={(e) => setSpeechVoiceURI(e.target.value || undefined)}
            className="min-w-0 flex-1 appearance-none rounded-md border border-clide-border bg-clide-bg px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-white/30"
          >
            <option value="" className="bg-clide-panel">
              Platform default
            </option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI} className="bg-clide-panel">
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
          <button
            onClick={runSpeakTest}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-clide-border px-2.5 py-1.5 text-[12px] text-white/70 hover:bg-white/5 hover:text-white"
          >
            <Volume2 size={13} /> Speak a sample
          </button>
        </div>
      )}

      {canListen && (
        <div className="mt-2 flex flex-col gap-1.5">
          <button
            onClick={runListenTest}
            disabled={testListening}
            className="flex w-fit items-center gap-1.5 rounded-md border border-clide-border px-2.5 py-1.5 text-[12px] text-white/70 hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            {testListening ? <Loader size={13} className="animate-spin" /> : <Mic size={13} />}
            {testListening ? "Listening…" : "Say something"}
          </button>
          {testTranscript && <div className="text-[12px] text-white/50">Heard: "{testTranscript}"</div>}
          {testError && <div className="text-[12px] text-red-400">{testError}</div>}
        </div>
      )}

      <div className="mt-4 border-t border-white/5 pt-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium text-white/80">Push-to-talk key</span>
          <span className="text-[12px] text-white/40">
            With speech mode on, the mic stays closed until you press this key — prevents accidental activation.
            Press once to start listening; press again to stop early.
          </span>
        </div>
        <select
          value={speechActivationKey}
          onChange={(e) => setSpeechActivationKey(e.target.value as (typeof SPEECH_ACTIVATION_KEYS)[number]["value"])}
          disabled={!canListen}
          className="mt-2 w-48 appearance-none rounded-md border border-clide-border bg-clide-bg px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-white/30 disabled:opacity-50"
        >
          {SPEECH_ACTIVATION_KEYS.map((k) => (
            <option key={k.value} value={k.value} className="bg-clide-panel">
              {formatSpeechActivationShortcut(k.value, isMac)}
            </option>
          ))}
        </select>
        {!canListen && (
          <div className="mt-1 text-[11px] text-white/30">Moot without voice input support in this environment.</div>
        )}
      </div>
    </div>
  );
}
