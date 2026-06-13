# Ticket 07 — Execution Engine

## Goal
Build the Bun-side script runner that takes form field values, constructs the shell command, executes the script, streams output back to the renderer, and records the run in history.

## Acceptance criteria
- Submitting a form triggers `runForm(formId, values)` RPC → returns a `runId` immediately
- The script is executed using `Bun.spawn()` with args constructed from the form's `argTemplate` field definitions
- stdout/stderr are streamed to the renderer as `OutputChunk` events in real-time
- On completion, the run record in SQLite is updated with `exit_code`, `finished_at`, and `status`
- A non-zero exit code sets status to `error`; exit code 0 sets status to `success`
- The runner respects the `outputType` from `form.json` — `table` output expects CSV/TSV or JSON from stdout; `image` expects a file path written to stdout; `audio`/`video` same
- Running a form that is already running does not start a second instance (guard with a `runningProcesses` map)
- Cancel: `cancelRun(runId)` RPC kills the process and sets status to `error` with a "cancelled" message

## Command construction
Given a field definition:
```json
{ "id": "post", "argTemplate": "--post {{value}}" }
```
And a value `"Hello world"`, the constructed arg is `--post "Hello world"` (shell-quoted).

Multi-value fields:
```json
{ "id": "platforms", "argTemplate": "--platforms {{values}}" }
```
Values `["Youtube", "Facebook"]` → `--platforms Youtube Facebook`

The full command is:
```
bash ~/.clide/forms/<slug>/script.sh <constructed args>
```

Or whatever interpreter is specified in `meta.json` (`interpreter: "bash" | "python3" | "node" | "bun"`).

## Output streaming protocol
```ts
interface OutputChunk {
  runId: string
  type: 'stdout' | 'stderr' | 'status'
  data: string           // raw text chunk, or JSON status update
  timestamp: number
}
```

The renderer subscribes to `onOutputChunk` RPC push event and appends chunks to the active run's output buffer.

## Output capture
For output types other than `text`, the runner captures full stdout to a temp file at `~/.clide/runs/<runId>/output`. The renderer loads this file after the run completes to display the appropriate output component.

## Files to create
- `src/bun/runner/execute.ts` — main run logic, Bun.spawn wrapper
- `src/bun/runner/argBuilder.ts` — constructs shell args from field values + argTemplate
- `src/bun/runner/outputCapture.ts` — stdout/stderr streaming + file capture
- `src/bun/runner/registry.ts` — in-memory map of running processes (runId → process)
