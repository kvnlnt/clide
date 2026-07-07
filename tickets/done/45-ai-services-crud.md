# Ticket 45 — AI Services CRUD in Settings

## Goal

The Settings page ([SettingsPanel.tsx](../src/mainview/components/SettingsPanel.tsx))
hardcodes exactly three providers (Claude / OpenAI / Ollama) as fixed fields.
Replace that with a full **CRUD list of AI services**: users add, edit, and
remove any number of services — local or remote — instead of filling in
predetermined slots. Keep the common case dead simple; tuck the rest behind
an "Advanced" disclosure.

## Acceptance criteria

### 1. Service model

- A service is: `id` (uuid), `name` (user label, e.g. "Work Claude",
  "Local Llama"), `kind` (preset), plus kind-specific config:
  - **Anthropic** — API key
  - **OpenAI** — API key
  - **OpenAI-compatible** — base URL + optional API key (covers LM Studio,
    vLLM, OpenRouter, Ollama's OpenAI endpoint, most local servers)
  - **Ollama (native)** — base URL
- **Simple by default**: adding a service asks only name, kind, and the one
  or two required fields. **Advanced** (collapsed disclosure): model
  override, base-URL override for the hosted kinds, request timeout.
- API keys stay in the system keychain
  ([credentials.ts](../src/bun/ai/credentials.ts)), keyed by service id —
  never in the JSON settings file. Non-secret config persists via
  [aiSettings.ts](../src/bun/ai/aiSettings.ts).

### 2. Settings UI

- Settings gains an "AI Services" section: a list (name, kind, key-saved
  badge, model if overridden) with add / edit / delete. Delete confirms
  inline. Edit reuses the add form pre-filled; key field shows the
  leave-blank-to-keep placeholder as today.
- One service can be marked **default** — used where the app needs a
  provider without asking.
- A **Test** button per service fires a minimal completion and shows
  pass/fail inline — critical for local endpoints.

### 3. Backend dispatch

- [providers.ts](../src/bun/ai/providers.ts) `complete()` dispatches on a
  service (id → config) instead of the `AIProvider` union; the
  OpenAI-compatible kind reuses the existing OpenAI request shape against a
  configurable base URL.
- Everything that currently selects an `AIProvider` (New Form Creator, magic
  fill, `DEFAULT_MODEL`) selects a service id instead.

### 4. Migration

- On first load, existing settings seed the list: saved Claude/OpenAI keys
  become services of those kinds; a configured `ollamaBaseUrl` becomes an
  Ollama service. Old fields are ignored afterward. Forms/specs persisted
  with the old provider strings resolve to the migrated service of that kind.

## Files to modify

- `src/mainview/components/SettingsPanel.tsx`
- `src/bun/ai/aiSettings.ts`, `credentials.ts`, `providers.ts`,
  `formGenerator.ts`, `magicFill.ts`
- `src/shared/types.ts` (service type, RPC additions, retire/deprecate
  `AIProvider` union)
- `src/bun/index.ts` (RPC handlers), `src/mainview/rpc.ts`
- New Form Creator provider picker (`NewFormPage.tsx` / `SpecEditor.tsx` —
  wherever the provider dropdown lives)

## Edge cases

- Deleting the default service: next remaining service becomes default;
  deleting the last service leaves AI features disabled with a clear
  "add a service in Settings" message, not a crash.
- Deleting a service referenced by an existing form's spec: runs of that
  form fall back to the default service with a visible note.
- Keychain write failures (user denies) surface inline on the service row.
