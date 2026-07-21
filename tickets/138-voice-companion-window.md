# Ticket 138 — Voice Companion: Floating "Jarvis" Window & Talk-Back

## Goal

CLIDE gets a voice and a face: a small (~200×200), chromeless,
draggable, always-on-top floating window — a highly stylized animated
circle with a waveform that moves when CLIDE speaks. On app open it
greets the user ("Hello, welcome to CLIDE. How can I help you today?")
and waits; it reads back command/workflow results and narrates errors.
This is the marketing centerpiece — the futuristic feel is the point,
and the animation quality deserves real design time.

## Acceptance criteria

### 1. The window (new plumbing)

- A second Electrobun `BrowserWindow`: frameless, transparent,
  always-on-top, ~200×200, draggable via its own surface (no title
  bar), position persisted. Note: this is the app's first second
  window — [index.ts](../src/bun/index.ts) creates only `mainWindow`
  today — so window lifecycle, IPC between the two windows, and
  show/hide from the main window are all new work. Land the window
  shell first if sequencing helps.

### 2. Two states

- **Compact**: the circle + waveform only.
- **Expanded**: toggled from the compact face, the window grows to show
  the running interaction transcript — what the user said/typed and
  what CLIDE said back — then collapses again. One window changing
  size/content, not two windows.

### 3. Talk-back behavior

- On app open, CLIDE speaks the greeting and (where recognition is
  supported) listens for a response through the ticket-123/137 speech
  pipeline. Run and workflow completions are read back — ticket 98's AI
  run summaries are the natural script — and errors are narrated.
- **Muted**: everything CLIDE would have said still appears as text —
  in the companion's transcript, with the compact face pulsing to draw
  the eye (satisfying the "dialog box that prints what CLIDE is
  saying" ask without a disruptive modal).

### 4. The animation

- The waveform is procedural, driven by `speechSynthesis` events
  (`start`/`boundary`/`end` from [speech.ts](../src/mainview/speech.ts))
  — WebKit exposes no audio buffer for real amplitude analysis, so the
  motion is designed, not sampled. It must still *feel* alive: idle
  breathing state, listening state, speaking state, all under the app's
  motion system ([index.css](../src/mainview/index.css), ticket 122)
  and `prefers-reduced-motion` aware.

### 5. Scope guard

- Epic-sized. Suggested sequencing: (a) window shell + IPC +
  drag/persist, (b) states + transcript, (c) talk-back wiring,
  (d) animation polish. Split into follow-ups at natural seams if it
  grows.

## Files to modify

- `src/bun/index.ts` (second window, lifecycle, IPC), new companion
  entry point + `src/companion/` (or equivalent) renderer surface
- `src/mainview/speech.ts`, `src/mainview/context/AppContext.tsx`
  (speech events → companion), `src/shared/types.ts` (window IPC/RPC)
- `src/bun/uiState.ts` (position, enabled, mute)
