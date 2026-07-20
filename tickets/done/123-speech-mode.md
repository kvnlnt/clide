# Ticket 123 — Speech Mode (Voice In, Voice Out)

## Goal

A wave icon in the top-right app menu area toggles **speech mode**: the
user speaks commands to the app and the app speaks back.

## Acceptance criteria

### 1. Entry point

- A wave icon (Lucide `AudioWaveform` or similar) joins the top-right
  header cluster ([Toolbar.tsx](../src/mainview/components/Toolbar.tsx) /
  header area near Settings). Toggling it enters/exits speech mode with a
  clear active state (listening indicator).

### 2. Voice in

- Speech is transcribed and routed through the existing command surface —
  the ⌘K picker / command input path — so anything typeable is sayable:
  run a task, open a surface, start a workflow.
- Mic permission is requested on first use with a graceful denied state.
  Transcription engine is implementer's choice (macOS native via
  Electrobun, local model, or configured AI service), but must degrade
  clearly when unavailable.

### 3. Voice out

- The app speaks results/confirmations (e.g. the ticket 98 one-line run
  summaries are the natural script: "Deploy site finished successfully").
  System TTS is fine.
- Speech mode off = zero audio, zero mic access. State does not persist
  as "listening" across restarts.

## Files to modify

- `src/mainview/components/Toolbar.tsx` (or the header component that owns
  the top-right cluster), new speech module under `src/mainview/`
- `src/bun/index.ts` + a new `src/bun/speech.ts` if native/process-side
  audio is needed

## Notes

Scope check: this is command-and-response, not a conversational agent.
Epic-adjacent — split if transcription lands separately from TTS.

## Implementation

Used the browser Web Speech API rather than a native/process-side
pipeline: `speechSynthesis` for voice out (near-universally supported,
including WebKit — no permission prompt, no AI round-trip) and
`SpeechRecognition`/`webkitSpeechRecognition` for voice in, feature-
detected since WebKit (Electrobun's webview on macOS) generally doesn't
implement recognition — the ticket explicitly anticipated and required
this ("must degrade clearly when unavailable").

- `src/mainview/speech.ts` — `speak()`, `stopSpeaking()`,
  `startListening()`/`isSpeechRecognitionSupported()`, with a minimal
  ambient `SpeechRecognition` type shape (no `@types` package ships one).
- `AppContext.tsx` — `speechModeActive`/`speechListening`/`speechError`
  state, never persisted (always off on boot, matching the ticket).
  Toggling on starts one listen-for-a-command session when supported; a
  recognized transcript opens the existing ⌘K `RunPicker` pre-filled via
  a `pendingSpeechQuery` handoff — voice commands run through the same
  surface as typed ones, not a separate code path. Toggling off stops
  any in-flight listen and cuts speech immediately
  (`speechHandleRef`/`stopSpeaking()`), plus an unmount cleanup so the
  mic is never left hot.
- Voice out wired into the existing `on("status", …)` push handler: when
  speech mode is active and a ticket-98 run summary streams in, it's
  spoken directly — "the natural script" the ticket names.
- `WindowControls.tsx` — the wave icon (`AudioWaveform`) joins the
  top-right cluster next to Settings; active state (amber), a pulsing
  listening dot, and a tooltip that's honest about degraded support
  ("voice output only — voice input isn't supported here") rather than
  presenting a silently broken mic button.

Verified via the Vite preview: the app boots and renders with the new
imports/hooks with zero console errors, and `isSpeechRecognitionSupported()`
/`isSpeechSynthesisSupported()` both report `true` in that Chromium-based
preview browser — confirming the feature-detection runs without
throwing. The wave icon itself only renders once a project is active, so
it wasn't visually reachable without the native bridge; not eyes-on
verified in the actual Electrobun/WebKit target, where voice input is
expected to degrade to the "voice output only" state by design.
