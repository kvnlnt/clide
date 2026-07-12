# Ticket 52 — Command-Backed Forms: Core Model & Direct Execution

Part of the **CLI-first re-envisioning epic** (52–56). CLIDE's fundamental
purpose is a CLI development environment: the user runs command-line tools
they already have installed through friendly forms, and composes flows over
the event bus rather than shell pipes. Guiding principle, adapted from the
Unix philosophy: **make each form do one thing well** — one form wraps one
invocation of one tool.

## Goal

Today a form is an AI-generated *script* (`script.sh` + `form.json`) run
through an interpreter. Replace the core model: a form describes a **direct
invocation of an installed CLI tool** — the tool, a fixed subcommand/base
args, and a mapping from form fields to arguments. No generated script sits
between the form and the tool. Script generation is out of scope for now
(may return later as an advanced path); existing script forms must keep
running.

## Acceptance criteria

### 1. Data model

- `FormDefinition` ([types.ts](../src/shared/types.ts)) gains a `command`
  block (present on new-style forms; `scriptFile` remains for legacy):
  - `tool`: reference to a registry entry or bare executable name (ticket 53
    defines the registry; until it lands, a bare name resolved on PATH).
  - `baseArgs`: fixed argv prefix, e.g. `["convert"]` for a subcommand.
  - Per-field arg mapping, expressed on `FormField`, covering at minimum:
    boolean → flag present/absent, value → `--flag <value>` or `--flag=<value>`,
    positional (with ordering), repeated values, environment variable, and
    "feed this field to stdin".
- `meta.json`/`form.json` persistence via
  [writer.ts](../src/bun/forms/writer.ts) /
  [loader.ts](../src/bun/forms/loader.ts) round-trips the new shape; loading
  a legacy script form is unchanged.

### 2. Execution

- [execute.ts](../src/bun/runner/execute.ts): a command-backed form spawns
  the tool directly (Bun `Subprocess`, argv array — **never** a shell string,
  no interpolation). Legacy forms keep the interpreter path.
- [argBuilder.ts](../src/bun/runner/argBuilder.ts) (or a successor) builds
  argv from the field mapping; unit-testable pure function.
- Streaming output, status FSM, cancellation, run history, and event
  emission all behave identically to script runs — the thread/cards don't
  care which kind ran.

### 3. Command preview

- A shared pure helper serializes a form + current input values into the
  exact command line that would run (display form, shell-quoted). Used by
  the form card (show what will run / what ran) and later by the wizard's
  live preview (ticket 54).
- The run record stores the resolved argv so past runs show what actually
  executed.

## Files to modify

- `src/shared/types.ts`
- `src/bun/runner/execute.ts`, `src/bun/runner/argBuilder.ts`
- `src/bun/forms/loader.ts`, `src/bun/forms/writer.ts`
- `src/mainview/components/FormCard*.tsx` (command preview display)
- New: shared command-serialization helper (importable from both processes)

## Edge cases

- Tool not found at run time → run fails fast with a clear "tool not
  installed" status message, not a cryptic spawn error.
- Field values containing spaces/quotes are safe by construction (argv
  array); the *preview* string must still quote them correctly for display.
- Empty optional fields contribute nothing to argv (no dangling `--flag`).
- A legacy script form and a command form coexisting in one project both
  load, run, and render.

## Note

Foundation for the rest of the epic: 53 (tool registry/inspection) gives
`tool` references something to resolve against; 54 (wizard) authors these
forms; 56 rides the same run pipeline for flows.
