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
