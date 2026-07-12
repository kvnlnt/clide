# Ticket 53 — Tool Registry & AI Inspection Service

Part of the CLI-first re-envisioning epic (52–56). Depends on ticket 52's
`command.tool` reference.

## Goal

CLIDE needs to *know about* the CLI tools on the user's machine before forms
can wrap them. Build the backend service and a management surface:

1. **Resolve & verify** a tool (PATH lookup or explicit path).
2. **Capture its self-documentation** — `--help` / `-h` / `help` subcommand /
   `man` page — safely.
3. **AI-distill** that text into a structured `ToolSpec` (what it does,
   subcommands, flags, positionals, examples) using a user-chosen AI service
   **and model**.
4. **Persist** registry entries so inspection happens once, not per wizard
   session.

## Acceptance criteria

### 1. Types & storage

- New shared types ([types.ts](../src/shared/types.ts)):
  - `ToolRegistryEntry`: id, display name, executable path (or PATH name),
    how it was added (`discovered` | `custom`), raw captured help text,
    optional `ToolSpec`, inspected-at timestamp + service/model used.
  - `ToolSpec`: description, subcommands (name + description), options
    (flag forms, value type, repeatable, description), positionals, usage
    examples. This is the structure the wizard (54) drafts fields from.
- Entries persist as flat files under `~/.clide/tools/` (one JSON per tool),
  consistent with the forms-on-disk philosophy. Path helpers in
  [paths.ts](../src/bun/paths.ts).

### 2. Help capture (main process)

- Given a resolved executable: try `--help`, then `-h`, then `help`, then
  `man <name>` (rendered to plain text via `col -b` or `MANPAGER=cat`),
  keeping the first substantive output. Capture stdout+stderr (many tools
  print help to stderr).
- Safety rails: hard timeout (a few seconds), stdin closed, output size cap,
  spawn with argv arrays (no shell), never pass user text as arguments to
  the probed tool.
- **Consent gate**: capturing help *executes the binary*. For anything not
  already registered, the UI must show what will be run (`/path/to/tool
  --help`) and get an explicit confirm before first execution. (Custom
  dropped executables — ticket 55 — always require this.)

### 3. AI distillation

- `distillToolSpec(helpText, service, model)` in a new `src/bun/ai/` module,
  reusing [providers.ts](../src/bun/ai/providers.ts) /
  [aiServices.ts](../src/bun/ai/aiServices.ts). The caller passes an
  explicit `AIService` id **and model override** — the wizard exposes both.
- Distillation failure (bad JSON, refusal, timeout) leaves the entry usable:
  raw help text is kept and the spec can be regenerated; the wizard can fall
  back to manual field building over the raw text.

### 4. RPC + Tools surface

- RPC ([index.ts](../src/bun/index.ts), `ClideRPC` in types.ts):
  `listTools`, `resolveTool` (PATH check + version probe), `inspectTool`
  (capture + distill, returns entry), `removeTool`, `updateTool` (rename,
  paste-in help text → re-distill).
- A **Tools page** (project-toolbar surface, full-width page per ticket 39
  conventions): registered tools with name/path/description, view raw help
  and distilled spec, re-inspect with a chosen service+model, remove. Empty
  state points at the wizard and drag-and-drop (55).

## Files to modify

- `src/shared/types.ts`
- `src/bun/paths.ts`, `src/bun/index.ts`
- New: `src/bun/tools/registry.ts`, `src/bun/tools/inspect.ts`,
  `src/bun/ai/toolSpec.ts`
- New: `src/mainview/components/ToolsPage.tsx` (+ ProjectToolbar entry)

## Edge cases

- Tool prints help and exits non-zero (common) — still a successful capture.
- Interactive/TUI tools that hang without args — the timeout must reliably
  kill the subprocess tree.
- `man` absent or page missing → fall through, not fail.
- Two entries for the same binary (PATH name vs. absolute path) — dedupe on
  resolved realpath.
- Huge help output (e.g. `ffmpeg -h full`) — truncate for the AI call,
  keep full text on disk.

## Note

Registry is machine-global (`~/.clide/tools/`), not per-project — the same
installed tool serves forms in every project.
