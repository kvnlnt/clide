/**
 * Speech mode (ticket 123): voice in via the Web Speech API's
 * SpeechRecognition (feature-detected — WebKit-based webviews, including
 * Electrobun's on macOS, generally don't implement it, so callers must
 * check `isSpeechRecognitionSupported()` and degrade clearly when it's
 * false), voice out via `speechSynthesis` (near-universally supported,
 * including WebKit — no permission prompt, no AI service round-trip).
 *
 * Command-and-response only, per the ticket: a recognized transcript is
 * handed to the caller to run through the existing ⌘K command surface,
 * not fed to a conversational agent.
 *
 * Ticket 137 adds a Settings home for this: a synthesis voice picker and a
 * configurable push-to-talk activation key, both persisted in UIState.
 */
import type { CompanionSpeechPhase, SpeechActivationKey } from "../shared/types";

// Minimal ambient shape for the non-standard SpeechRecognition API — no
// @types package ships one, and this project only needs a few members.
interface SpeechRecognitionResultLike {
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike {
  results: { [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== "undefined" && !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Available synthesis voices. Empty until the browser loads them — see loadVoicesWhenReady. */
export function listVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisSupported()) return [];
  return window.speechSynthesis.getVoices();
}

/**
 * Voice lists load asynchronously in most engines. Calls `onVoicesChanged`
 * once now (in case they're already loaded) and again whenever the
 * `voiceschanged` event fires; returns an unsubscribe function.
 */
export function loadVoicesWhenReady(onVoicesChanged: (voices: SpeechSynthesisVoice[]) => void): () => void {
  if (!isSpeechSynthesisSupported()) return () => {};
  const handler = () => onVoicesChanged(window.speechSynthesis.getVoices());
  handler();
  window.speechSynthesis.addEventListener("voiceschanged", handler);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", handler);
}

/**
 * Speak a line of text (voice out). No-ops silently when unsupported.
 * `voiceURI` picks a specific voice (ticket 137); absent/unmatched falls
 * back to the platform default. `onPhase` (ticket 138) fires on the
 * utterance's start/boundary/end lifecycle — the voice companion window
 * relays these over IPC to drive its procedural waveform, since WebKit
 * exposes no audio buffer to sample real amplitude from.
 */
export function speak(text: string, voiceURI?: string, onPhase?: (phase: CompanionSpeechPhase, charIndex?: number) => void): void {
  const trimmed = text.trim();
  if (!trimmed || !isSpeechSynthesisSupported()) return;
  // Don't queue over whatever's already being said — the newest result wins.
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(trimmed);
  const voice = voiceURI ? window.speechSynthesis.getVoices().find((v) => v.voiceURI === voiceURI) : undefined;
  if (voice) utterance.voice = voice;
  if (onPhase) {
    utterance.onstart = () => onPhase("start");
    utterance.onboundary = (e) => onPhase("boundary", e.charIndex);
    utterance.onend = () => onPhase("end");
    utterance.onerror = () => onPhase("end");
  }
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}

export interface ListenHandle {
  stop: () => void;
}

/**
 * Start one listen-for-a-command session (voice in). Caller must check
 * `isSpeechRecognitionSupported()` first — this throws if called when
 * unsupported, matching the "must degrade clearly" requirement: the
 * caller owns showing that state, this module never fails silently.
 */
export function startListening(
  onResult: (transcript: string) => void,
  onError: (message: string) => void,
  onEnd: () => void,
): ListenHandle {
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Ctor) throw new Error("Speech recognition is not supported in this environment.");

  const recognition = new Ctor();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript;
    if (transcript) onResult(transcript);
  };
  recognition.onerror = (event) => {
    const message =
      event.error === "not-allowed" || event.error === "permission-denied"
        ? "Microphone access was denied — allow it in system settings to use speech mode."
        : event.error === "no-speech"
          ? "Didn't catch that — try again."
          : `Speech recognition error: ${event.error}`;
    onError(message);
  };
  recognition.onend = onEnd;

  try {
    recognition.start();
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err));
  }

  return { stop: () => recognition.stop() };
}

/**
 * Push-to-talk activation key presets (ticket 137). Each is always chorded
 * with Cmd (mac) / Ctrl (other) + Shift, matching the app's existing
 * modifier-chord shortcut scheme (see App.tsx's onKeyDown) — a bare key
 * would fire while typing anywhere else in the app.
 */
export const SPEECH_ACTIVATION_KEYS: { value: SpeechActivationKey; eventKey: string; label: string }[] = [
  { value: "l", eventKey: "l", label: "L" },
  { value: "m", eventKey: "m", label: "M" },
  { value: "space", eventKey: " ", label: "Space" },
  { value: "grave", eventKey: "`", label: "`" },
];

/** Human-readable chord for the given activation key, e.g. "⌘⇧L" on mac, "Ctrl+Shift+L" elsewhere. */
export function formatSpeechActivationShortcut(key: SpeechActivationKey, isMac: boolean): string {
  const preset = SPEECH_ACTIVATION_KEYS.find((k) => k.value === key) ?? SPEECH_ACTIVATION_KEYS[0]!;
  return isMac ? `⌘⇧${preset.label}` : `Ctrl+Shift+${preset.label}`;
}
