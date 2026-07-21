# Ticket 137 — Speech Settings Section & Push-to-Talk Activation

## Goal

Speech mode (ticket 123) gets a home in Settings — configure it, test
it — and listening becomes deliberate: even with speech mode enabled, a
short key press is required to open the mic, preventing accidental
activation.

## Acceptance criteria

### 1. Settings section

- A "Speech" section in
  [SettingsPanel.tsx](../src/mainview/components/SettingsPanel.tsx):
  shows recognition/synthesis support status (the feature-detection in
  [speech.ts](../src/mainview/speech.ts) — recognition is generally
  unsupported in Electrobun's WebKit webview, and the section must say
  so plainly rather than dangle broken controls), a voice picker for
  synthesis, a test button for each direction ("say something" /
  "speak a sample"), and the activation-key setting from §2.
- Speech preferences persist in uiState (today `speechModeActive` etc.
  live only in [AppContext.tsx](../src/mainview/context/AppContext.tsx)
  and vanish on relaunch — enabled-ness staying off on boot is fine to
  keep, but voice/key preferences should persist).

### 2. Push-to-talk

- With speech mode toggled on (the `SpeechModeButton` in
  [WindowControls.tsx](../src/mainview/components/WindowControls.tsx)),
  the mic no longer opens immediately. A configurable short key
  (default: hold or tap — pick one and document it) starts each
  `startListening()` session; visual state clearly distinguishes
  "armed" from "listening."
- The key is registered through the existing keyboard-shortcut
  machinery and respects overlay-open guards.

## Files to modify

- `src/mainview/components/SettingsPanel.tsx` (+ optional
  `SpeechSettingsSection.tsx`), `src/mainview/speech.ts`,
  `src/mainview/context/AppContext.tsx`,
  `src/mainview/components/WindowControls.tsx`
- `src/bun/uiState.ts` / `src/shared/types.ts` (persisted prefs)
