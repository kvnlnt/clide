# Ticket 76 — First-Run AI Service Wizard ("First things first")

## Goal

CLIDE's headline features (form creation, tool inspection, magic fields) all
need an AI service, but a fresh install has none registered and nothing tells
the user that — features just quietly don't work. When **no AI service is
registered**, take over the full window with a friendly, dedicated setup
screen that walks the user through registering their first one.

Tone matters here: this is a warm hand-hold, not a settings form. Headline
along the lines of **"First things first"** with a short, plain explanation —
e.g. *"CLIDE's features are powered by AI. Connect a service to get started —
this can be a local model running on your machine (like Ollama) or a remote
provider (like Claude or OpenAI). You can add more or change this anytime in
Settings."* Wording should be clear to someone who has never configured an AI
provider before.

## Acceptance criteria

### Trigger & takeover

- On launch (and any time the last service is deleted), if the registered AI
  services list is empty, show the wizard as a **full-window takeover** — same
  pattern as Settings (ticket 37) and the form wizard (ticket 67): no tab
  strip, no sidebar, no distractions.
- Once at least one service is registered, the wizard never appears again on
  its own. It is not a nag: if the user explicitly dismisses/skips it (there
  should be a quiet "skip for now" escape hatch), let them into the app and
  don't re-prompt until next launch.

### The hand-holding flow

- Step-by-step, one decision per screen (or one clearly chunked page):
  1. **Local or remote?** Two friendly cards explaining the tradeoff in one
     sentence each (local = private/free/needs the model installed; remote =
     easiest/most capable/needs an API key).
  2. **Pick the provider** (Claude / OpenAI / Ollama / custom endpoint —
     whatever the existing AI Services CRUD from ticket 45 supports).
  3. **Credentials/connection** — API key field for remote (stored in the
     keychain like ticket 45 does), base URL/port for local with a sensible
     prefilled default.
  4. **Test & confirm** — a "test connection" that actually pings the
     service and shows a clear success/failure state with a human-readable
     hint on failure ("Is Ollama running? Try `ollama serve`").
- Finishing lands the user wherever they were headed (welcome screen or
  their project thread) with a small success toast.
- Reuse the service model/validation logic from the existing AI Services
  settings section — this is a new front door, not a second implementation.

## Files to modify

- `src/mainview/components/FirstRunAIWizard.tsx` (new)
- `src/mainview/App.tsx` (takeover gating, same overlay layer as Settings)
- `src/mainview/context/AppContext.tsx` (services-empty signal, skip state)
- `src/mainview/components/SettingsPanel.tsx` (extract/reuse service form +
  test-connection pieces)
- `src/bun/ai/*` (test-connection RPC if one doesn't already exist)

## Edge cases

- Service exists but is misconfigured/unreachable: out of scope — the wizard
  only triggers on *zero registered services*.
- Deleting the last service from Settings while the app is open: don't
  yank the user into the wizard mid-task; show it on next launch (or when
  they next hit an AI-dependent flow).
- Interplay with ticket 78: on a completely fresh install (no project *and*
  no AI service), the first-project welcome flow runs first and chains into
  this wizard — don't stack two takeovers.
