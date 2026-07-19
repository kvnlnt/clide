# Ticket 99 — Native Tools & Browser Automation (Epic)

## Goal

Introduce **native tools**: capabilities built into the CLIDE runtime that
appear alongside installed CLI tools when creating a new task. The first
native tool is **Browser Automation** — Electrobun can launch and control
webviews, so a task can drive a real browser through a user-built sequence
of steps: record interactions, replay them, chain them, and parameterize
them with normal task fields.

This deliberately breaks the "pure CLI" convention: a native-tool task has
no `script.sh`/spawned command — the Bun process executes it directly. The
task _contract_ (fields on top, run history, statuses, outputs, thread
cards, workflows, scheduling) is identical.

This is an epic; expect it to split into follow-up tickets (registry/model,
recorder, step builder, replay engine) during grooming — acceptance below
defines the full shape.

## Acceptance criteria

### 1. Native tool registry

- `src/bun/tools/native.ts` defines a `NativeTool` descriptor (id, name,
  description, icon, capability schema). The wizard's tool-choice step
  (ticket 60, [registry](../src/bun/tools/)) shows a distinct **"Native"**
  section above installed CLI tools — visually differentiated (icon +
  badge), since these need no inspection/`--help` capture. Ordering
  contract with ticket 103: Native at the very top, then registered tools,
  then PATH-resolvable binaries, then 103's package-manager catalog
  expansion at the bottom — whichever ticket lands second slots in without
  rearranging the other.
- Task model: `TaskDefinition` gains a discriminated engine —
  `command`-backed (today's path, unchanged) vs `native`-backed
  (`nativeTool: "browser-automation"`, tool-specific config blob persisted
  in the task folder, e.g. `browser.json`). Loader/writer/runner branch on
  it; everything downstream (history, outputs, workflows) is engine-blind.

### 2. Browser automation task = fields + steps

- Creating a task with the Browser Automation tool opens a **step builder**
  instead of the CLI mapping steps; the field-CRUD step (ticket 61) stays —
  the user defines required fields up top exactly like any task (e.g.
  "Search term", "Login email").
- A task is an ordered list of **steps**. Step types (each a card in a
  vertical builder, ticket-91 editor conventions — reorder, enable/disable,
  expand to edit):
  - **Navigate** — URL (supports `{{fields.x}}` via the ticket-88
    expression language).
  - **Recorded interaction** — produced by record mode (§3); replayable as
    one unit; expandable to show/edit its captured events.
  - **Click / Type / Select** — manual single actions targeting a selector;
    Type supports `{{fields.x}}`.
  - **Wait** — for selector, navigation, or fixed delay.
  - **Extract** — selector (+ attribute/text) → a **named output**, feeding
    the ticket-86 output-definitions pipeline.
  - **Assert** — selector/text condition; failure fails the run with a
    clear message.
  - **Screenshot** — captures to the run's artifacts.
  - **Coordinate action** (fallback mode, §4) — x/y + event.
- Steps replay individually from the builder ("play this step") and
  end-to-end ("run all") for authoring-time verification.

### 3. Record mode

- A **Record** toggle opens a dedicated Electrobun browser window with a
  visible recording banner. A recorder script injected into the page
  captures clicks, input, key events, scrolls, and navigations.
- Selector strategy is the smart part: capture a **resilient selector
  chain** per event — priority `data-testid`/`id` → aria/role+name →
  text content → CSS path — storing _all_ candidates so replay can fall
  through when the page shifts. (This is the modern Playwright-style
  answer; plain recorded CSS paths rot.)
- Toggling record off yields **one Recorded-interaction step** appended to
  the builder. Record can be toggled repeatedly to build multiple steps.
- During recording, typed values into fields the user marked as
  parameterized are replaced with `{{fields.x}}` references (offer the
  substitution when a typed value matches a field's current value).

### 4. Coordinate fallback mode (for canvas/hostile pages)

- When DOM recording can't work, a step can be authored in **coordinate
  mode**: the automation window is forced to a **fixed, stored viewport
  size** (and DPR), the user clicks positions on a live view or captured
  screenshot, and the step stores x/y + event type.
- Replay re-creates the window at exactly that geometry before dispatching.
  If the saved geometry can't be honored (screen too small), the run fails
  with an explicit geometry error rather than clicking blind.
- Each coordinate step stores a reference screenshot so the builder can
  show _what_ the point targets.

### 5. Execution engine

- `src/bun/runner/browserRun.ts`: runs steps sequentially in a (visible by
  default; headless-if-possible later) Electrobun webview; per-step
  timeout, retries-with-selector-fallthrough, and structured logging into
  the existing `OutputCapture` stream — the thread card shows step-by-step
  progress like a CI trace (ticket 94 pattern).
- Statuses map to the normal run FSM; Extract steps populate named
  outputs; screenshots land as artifacts on the run.
- Works as a workflow step, on a schedule, and from ⌘K — it's just a task.
- **Safety**: automation windows are clearly badged as automated, only one
  browser run executes at a time (serialize via the scheduler), and stored
  step data never includes values from fields marked secret (the
  `secret` field flag + masking helper introduced by ticket 98; if this
  lands first, add that flag/helper here and 98 reuses it).

### 6. Wizard & surfaces integration

- New-task wizard: choosing Browser Automation at the tool step routes to
  fields-CRUD → step builder → outputs (86/87) — reusing the step-header
  navigation (ticket 63).
- The task's detail/edit surface opens the step builder; FormsPanel/
  TasksPanel rows show a small "native" badge.

## Files to modify

- New: `src/bun/tools/native.ts`, `src/bun/runner/browserRun.ts`,
  `src/bun/browser/` (window mgmt, recorder-script injection, selector
  engine), `src/mainview/components/browser/` (StepBuilder, step cards,
  recorder controls, coordinate picker)
- `src/shared/types.ts` (engine discriminator, step types, RPC),
  `src/bun/forms/loader.ts` + `writer.ts`, `src/bun/runner/execute.ts`,
  `src/bun/index.ts`, wizard components (steps 2–4), `FormsPanel.tsx`

## Edge cases

- Auth walls: recording against a logged-in session — decide whether the
  automation webview shares a persistent profile per task (cookies survive
  between runs) and surface that as a per-task toggle.
- Pages that navigate mid-recording (SPAs vs full loads) must not drop the
  recorder injection — re-inject on every navigation.
- Replay divergence: when every selector candidate misses, fail with the
  step's reference screenshot vs a live screenshot side-by-side so the user
  can see what changed. (AI-assisted selector repair is a natural follow-up
  ticket, not in scope.)
- Infinite waits: hard cap per-step and per-run wall time.
- Dry-run (ticket 95) for a browser task = list the steps and compiled
  values without opening a window.

## Note

Written in ticket-96 vocabulary ("task") — the files list's `forms/` paths
and `FormsPanel` read as `tasks/` / `TasksPanel` after 96. Sequence after
96; independent of 97/98. Artifacts: if ticket 102 has landed,
screenshots/downloads register as `RunArtifact` records; if this lands
first, write screenshots under the run's output-capture location and
record their paths in the browser run trace so 102 can adopt them
wholesale. Tool-choice ordering is coordinated with ticket 103 (§1).
