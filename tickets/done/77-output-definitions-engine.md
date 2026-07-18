# Ticket 77 — Output Definitions: Explicit, Configurable, ETL-Capable (Model & Engine)

## Goal

Today a form's outputs are a flat list of bare kinds (`text`, `table`,
`json`, …) — nothing is configurable, nothing extracts or transforms, and
two JSON outputs can't even be told apart. Replace that with **named,
explicitly defined outputs**: the CLI's raw output is always returned as-is,
and each *output definition* additionally extracts (and optionally lightly
transforms) a piece of it. These named outputs are the ports the upcoming
pipeline/workflow automation will wire together — this ticket builds the
model, engine, and per-run persistence; ticket 78 builds the authoring UI
and display.

## Acceptance criteria

### 1. Data model ([types.ts](../src/shared/types.ts))

- New `OutputDefinition`:
  ```ts
  {
    id: string;            // stable within the form — the future pipeline wiring target
    name: string;          // user label, e.g. "Upload URL", "Size report"
    kind: OutputType;      // how the result is typed/rendered: text | table | json | image | audio | video
    extraction: Extraction;
    transforms?: Transform[];
  }
  ```
- `Extraction` is explicit about where and what:
  - `source`: `"stdout"` (default) | `"stderr"` | `"file"` (a filesystem
    path *named by* the selector below — how media outputs work today,
    finally made explicit instead of the implicit "last printed line" rule);
  - `selector`: `{ type: "whole" }` | `{ type: "regex", pattern, group? }`
    | `{ type: "jsonPath", path }` (dot-path into parsed stdout)
    | `{ type: "lines", from?, to? }` | `{ type: "lastPathLine" }`.
- `Transform` starts small and composable (applied in order):
  `{ type: "pickKeys", mapping: Record<string,string> }` (select + rename
  JSON keys — the "translate them a bit" case), `{ type: "template",
  template: "..." }` (string with `{{value}}` / `{{key}}` slots),
  `{ type: "parseNumber" }`, `{ type: "trim" }`.
- `FormDefinition.outputs` becomes `OutputDefinition[]`. **Migration on
  load** ([loader.ts](../src/bun/forms/loader.ts)): legacy `outputs:
  [{kind}]` / bare `outputType` normalize to one definition per kind —
  `whole`-stdout extraction for text/table/json, `lastPathLine`+file for
  media — named after the kind. Legacy `outputType` field stays populated
  (first definition's kind) for old readers.

### 2. Extraction engine

- New pure module (e.g. `src/shared/outputs.ts` or `src/bun/runner/outputs.ts`
  if node-only): `evaluateOutputs(defs, { stdout, stderr }) →
  { id, name, kind, ok, value?, error? }[]`. Deterministic, no AI, no shell.
  A failing selector (no regex match, bad JSON path) yields `ok: false`
  with a human-readable error — never throws, never blocks the run result.
- Multiple definitions of the same kind are fully supported (the point):
  two `jsonPath` extractions over the same stdout are two named results.

### 3. Per-run persistence

- [execute.ts](../src/bun/runner/execute.ts): after a run completes, the
  engine evaluates the form's definitions against the captured output and
  persists the results to the run's folder (e.g.
  `runDir(...)/outputs.json`, media values as the resolved file path) — the
  durable, named artifact set the workflow layer will consume.
- New RPC `getRunOutputs { runId } → { id, name, kind, ok, value|path,
  error }[]` for the renderer (ticket 78) and future automation.
  `readOutputFile` keeps working for legacy runs.

## Files to modify

- `src/shared/types.ts`, `src/bun/forms/loader.ts`
- New: extraction engine module
- `src/bun/runner/execute.ts`, `src/bun/index.ts`, `src/mainview/rpc.ts`
- `src/mainview/types/forms.ts` (re-exports)

## Edge cases

- Raw output is sacred: extraction failures or zero definitions never
  affect the run's status or the raw stream shown on the card.
- `jsonPath` against non-JSON stdout → `ok: false` with "output wasn't
  valid JSON", not a crash.
- `file`-source values are validated to exist at evaluation time; missing
  file → `ok: false` with the path in the error.
- Huge stdout: selectors operate on the captured text (already size-managed
  by OutputCapture); the engine adds no additional buffering.

## Note

Depends on 76 (events out of the outputs step). Ticket 78 delivers the
wizard authoring UI and run-card rendering on top of this.
