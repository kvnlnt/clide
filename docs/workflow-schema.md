# CLIDE Workflow Schema & Expression Language

Workflows orchestrate existing CLIDE forms into ordered, multi-step
automations. This document is the reviewed source of truth for the on-disk
format (tickets 79-86).

## Vocabulary

- **Workflow** — a named, ordered list of steps plus zero or more triggers.
- **Step** — one item in a workflow: *form step*, *decision step*, *loop
  step*, or *parallel step*.
- **Trigger** — what starts a run: *manual*, *schedule* (cron), or
  *form-submitted*. Workflows start **only** via triggers; submitting a form
  on its own never propagates into a workflow.
- **Run** — one execution, persisted as a full trace.

## Files

- Definitions: `<project>/workflows/<slug>.json` — one JSON file per
  workflow, diffable and versionable. The filename follows the name; `id`
  is identity.
- Run traces: `<project>/workflow-runs/<runId>.json` — includes a snapshot
  of the definition at run time, so replays resolve against what actually
  ran.

## Workflow file

```json
{
  "id": "3f1c…",
  "name": "Publish digest",
  "description": "Fetch, filter, and publish the RSS digest",
  "params": ["channel"],
  "enabled": true,
  "createdAt": "2026-07-12T09:00:00.000Z",
  "updatedAt": "2026-07-12T09:00:00.000Z",
  "triggers": [
    { "type": "manual" },
    { "type": "schedule", "cron": "0 9 * * 1-5" },
    { "type": "form-submitted", "formSlug": "fetch-rss" }
  ],
  "steps": [
    {
      "type": "form",
      "name": "fetch_rss",
      "formSlug": "fetch-rss",
      "inputs": { "url": "https://example.com/feed.xml" }
    },
    {
      "type": "decision",
      "name": "has_items",
      "condition": "fetch_rss.outputs.items.length > 0",
      "then": [
        {
          "type": "loop",
          "name": "each_item",
          "over": "fetch_rss.outputs.items",
          "steps": [
            {
              "type": "form",
              "name": "post_item",
              "formSlug": "post-to-channel",
              "inputs": { "title": "{{item.title}}", "channel": "{{trigger.params.channel}}" }
            }
          ]
        }
      ],
      "else": [
        { "type": "form", "name": "notify_empty", "formSlug": "notify", "inputs": { "message": "No items today" } }
      ]
    }
  ]
}
```

Step types:

| type | fields |
| --- | --- |
| `form` | `formSlug`, `inputs` (field id → literal or `{{…}}` string) |
| `decision` | `condition` (expression), `then` (steps), `else?` (steps) |
| `loop` | `over` (expression → list), `steps`; current element bound as `item` |
| `parallel` | `branches` (≥2 step lists, concurrent, rejoining) |

Sub-lists nest arbitrarily deep. Every step has a unique, slug-safe `name`
(`^[a-z][a-z0-9_-]*$`) — the reference target.

## References & expressions

`{{expr}}` inside a form-step input string resolves against the run scope.
A field that is exactly one `{{expr}}` receives the raw value (lists/objects
allowed); otherwise values interpolate (objects as JSON).

Addressable roots:

- Prior form-step names → `{ stdout, stderr, exitCode, outputs.<name> }`
  where `<name>` is the form's output-definition name (ticket 77).
- `trigger` → `{ params.<name> }` (manual), or for form-submitted:
  `{ inputs.<fieldId>, stdout, stderr, exitCode, outputs.<name> }`.
- `item` — the current element, inside loops only.

Expression grammar (minimal and safe; no arbitrary JS, no eval):

```
expr    := or
or      := and ( "||" and )*
and     := unary ( "&&" unary )*
unary   := "!" unary | compare
compare := primary ( ("==" | "!=" | "<=" | ">=" | "<" | ">") primary )?
primary := literal | path | "(" expr ")"
path    := ident ( "." (ident | integer) )*     -- ".length" on strings/arrays
literal := number | string | true | false | null
```

Strict semantics: `==`/`!=` are strict equality (no coercion); `< <= > >=`
return `false` unless both sides are numbers; missing properties evaluate to
`undefined` (never an error at evaluation time — the editor flags unknown
references at edit time instead).

### Scope rules

A step may reference any step **guaranteed to have completed before it**:
earlier siblings and ancestors' earlier siblings. Consequences:

- Steps in a *parallel sibling branch* are out of scope for each other.
- After a parallel step joins, all its branches' form steps are in scope.
- Steps inside a decision branch are out of scope after the decision (which
  branch ran is a runtime fact), and inside a loop after the loop (zero
  iterations is possible).

## Triggers

- `manual` — the Run button; prompts for `params` when declared.
- `schedule` — cron subset `m h dom mon dow` supporting numbers, `*`, `,`,
  `-`, `/`. Evaluated **only while the app is running**; missed fires do
  not back-fill. No daemon in v1.
- `form-submitted` — fires when a **standalone** run of the referenced form
  completes successfully (outputs must exist to be a useful payload). Form
  steps inside a workflow never trigger other workflows (no cascades, v1).

## Runs

Per-step records carry: name (loop iterations indexed `post_item[2]`,
parallel branches prefixed), status (`pending/running/succeeded/failed/
skipped`), the exact resolved command string, stdout, stderr, exit code,
duration, resolved inputs, and evaluated outputs. Failure policy v1: a
failed step halts the workflow; the rest are marked skipped. Untaken
decision branches are recorded skipped with the evaluated condition.
