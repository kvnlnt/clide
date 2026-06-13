# Ticket 10 — New Form Creator (AI-Powered)

## Goal
When no existing form matches what the user wants, they can create one. The creation flow itself appears as a special FormCard in the thread — the user fills it out like any other form, and AI handles writing the script, generating the form config, and making it immediately available.

## Acceptance criteria
- "Create new form" option in the Form Selector (ticket 09) adds a `NewFormCard` to the top of the thread
- The NewFormCard has fields: **Name**, **Description** (what should this form do?), **AI Provider**, **AI Credentials** (if not already saved)
- On submit, AI is called to: analyze the request, determine what script is needed, check/suggest dependencies, generate the script + `form.json` + `meta.json`
- Progress is shown inline in the card (streaming AI response as status messages)
- When complete, the new form folder is written to `~/.clide/forms/<slug>/`, the filesystem watcher picks it up, and the new form immediately appears in the selector
- The NewFormCard then transitions: it collapses and is replaced by a new expanded FormCard for the newly created form — user can run it immediately
- If AI encounters an error (bad credentials, network error, etc.), the card shows the error inline with a retry option

## AI Provider setup
- The user selects an AI provider and enters their API key once per provider
- Supported providers: **Claude (Anthropic)**, **OpenAI**, **Ollama (local)**
- Credentials are stored securely via Electrobun's keychain access (or system keychain via Bun) — never in plain text files
- Provider selection and credential entry are part of the NewFormCard fields, shown only if credentials aren't already stored for that provider
- Provider selection can also be reached from a Settings screen (future ticket); for now it's surfaced here

## AI prompt (Bun-side, `src/bun/ai/formGenerator.ts`)
The prompt sent to the AI includes:
1. User's name and description of the desired form
2. The local machine's OS, shell, and available interpreters (detected at runtime: `which python3`, `which node`, etc.)
3. The `form.json` schema spec (from ticket 02) so the AI knows what structure to produce
4. Instructions to check for required CLI tools and emit installation instructions if missing
5. Instructions to write a robust, commented shell script

The AI response must be structured (use tool use / JSON mode) to produce:
```json
{
  "meta": { ...FormMeta },
  "form": { ...FormDefinition },
  "script": "#!/bin/bash\n...",
  "scriptExtension": "sh",
  "dependencyCheck": "which ffmpeg >/dev/null 2>&1 || echo 'MISSING: ffmpeg'",
  "installInstructions": "brew install ffmpeg"
}
```

## Dependency handling
- Before writing the script, the generator runs `dependencyCheck` via `Bun.spawn()`
- If dependencies are missing, the NewFormCard shows a dependency warning panel with the `installInstructions`
- User can click "Install" to run the install command inline (with confirmation), or "Skip" to proceed anyway

## Files to create
- `src/mainview/components/NewFormCard.tsx` — special form card for creation flow
- `src/mainview/components/DependencyWarning.tsx` — dependency check + install UI
- `src/bun/ai/formGenerator.ts` — AI prompt construction + response parsing
- `src/bun/ai/providers.ts` — provider abstraction (Claude / OpenAI / Ollama)
- `src/bun/ai/credentials.ts` — secure credential storage/retrieval via system keychain
- `src/bun/forms/writer.ts` — writes generated form folder to disk
