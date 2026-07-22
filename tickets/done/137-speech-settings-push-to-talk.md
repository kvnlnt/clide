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

## Implementation notes

### 1. Settings section

Built as the optional `SpeechSettingsSection.tsx`, mounted in
`SettingsPanel.tsx` below Package Managers. Recognition and synthesis each
get their own support-status row (feature-detected via `speech.ts`); when
recognition is unsupported the "Say something" test button and its row
don't render at all — replaced by a plain sentence explaining why — rather
than sitting there disabled. The voice picker lists
`speechSynthesis.getVoices()` (loaded async via a new `loadVoicesWhenReady`
helper, since most engines populate the list after a `voiceschanged`
event); "Speak a sample" calls `speak()` with the selected voice, "Say
something" runs a one-off `startListening()` session and prints the
transcript or error inline. `speechVoiceURI` and `speechActivationKey` were
added to `UIState`/`shared/types.ts` and round-trip through
`getUIState`/`saveUIState` exactly like `compactMode`/`calendarView`;
`speechModeActive` itself stays session-only, per the ticket.

### 2. Push-to-talk

`toggleSpeechMode` no longer calls `listenOnce()` on the way to "on" — it
only arms the mode now. A new `pressToTalk()` opens one `startListening()`
session, or stops an in-flight one early if pressed again while listening.
It's bound to a global `keydown` listener in `AppContext.tsx` that mirrors
the modifier-chord convention and overlay-open guard already used by
`App.tsx`'s shortcut dispatcher (`newTaskOpen`/`appSettingsOpen`/etc., plus
requiring an active project) rather than a bare key, since a bare key would
fire while typing anywhere else in the app. Chose **tap**, not hold: press
once to start listening, press again to stop early, otherwise it ends on
its own the same way voice commands already do. Default key is
Cmd/Ctrl+Shift+L; three more presets (M, Space, `` ` ``) are offered in the
Settings picker via `SPEECH_ACTIVATION_KEYS`/`formatSpeechActivationShortcut`
in `speech.ts`. `WindowControls.tsx`'s mic button now shows a static amber
ring when armed (mode on, mic closed) versus the pulsing icon + dot when
actually listening, and its tooltip names the configured shortcut.

Not verified live in a running Electrobun window — `tsc --noEmit` and
`vite build` both pass, but the app's RPC bridge needs the native shell to
boot, which isn't reachable from this environment's browser preview tools.
