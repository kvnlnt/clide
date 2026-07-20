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
 */

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

/** Speak a line of text (voice out). No-ops silently when unsupported. */
export function speak(text: string): void {
  const trimmed = text.trim();
  if (!trimmed || !isSpeechSynthesisSupported()) return;
  // Don't queue over whatever's already being said — the newest result wins.
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(trimmed));
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
