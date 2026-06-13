# Ticket 02 — Data Layer

## Goal
Build the Bun-side layer that reads form/script folders from disk, watches for changes, and persists run history in SQLite.

## Acceptance criteria
- `listForms()` RPC call returns all valid form folders from `~/.clide/forms/`
- Adding or removing a folder from `~/.clide/forms/` is detected live (no restart required)
- Each form's `form.json` and `meta.json` are validated on load; malformed folders are skipped with a console warning
- Run history (which form ran, when, with what inputs, final status) is stored in SQLite at `~/.clide/history.db`
- `getRunHistory(formId, limit)` RPC returns the N most recent runs for a form

## Form folder spec

### `meta.json`
```json
{
  "name": "Create Media Post",
  "slug": "create-media-post",
  "description": "Publishes a post to selected social platforms",
  "project": "Abounding Grace",
  "tags": [],
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

### `form.json`
```json
{
  "fields": [
    {
      "id": "post",
      "label": "Post",
      "type": "textarea",
      "placeholder": "Enter your post here...",
      "required": true,
      "argTemplate": "--post {{value}}"
    },
    {
      "id": "platforms",
      "label": "Platforms",
      "type": "multicheck",
      "options": ["Youtube", "Facebook", "X", "Instagram"],
      "argTemplate": "--platforms {{values}}"
    }
  ],
  "aiPromptField": true,
  "outputType": "text",
  "scriptFile": "script.sh"
}
```

**Field types to support**: `text`, `textarea`, `select`, `multicheck`, `number`, `file`, `date`

**Output types**: `text`, `table`, `image`, `audio`, `video`, `json`

### SQLite schema (`~/.clide/history.db`)
```sql
CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  form_slug TEXT NOT NULL,
  inputs TEXT NOT NULL,       -- JSON blob of field values
  status TEXT NOT NULL,       -- pending | running | success | error
  exit_code INTEGER,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  output_path TEXT            -- path to captured output file if any
);
```

## Implementation notes
- Use `Bun.file()` + `JSON.parse()` for reading form folders — no external deps
- Use `fs.watch()` (Node-compatible in Bun) on the forms root to detect additions/removals; debounce 300ms
- When a change is detected, push an updated form list to the renderer via an RPC push event (`onFormsChanged`)
- Use `bun:sqlite` for history.db; run migrations on startup via `db.run(CREATE TABLE IF NOT EXISTS ...)`
- Run IDs are `crypto.randomUUID()`

## Files to create
- `src/bun/forms/loader.ts` — scans and validates form folders
- `src/bun/forms/watcher.ts` — fs.watch wrapper with debounce
- `src/bun/db/history.ts` — SQLite history repository
- `src/bun/db/migrations.ts` — schema setup
- `~/.clide/forms/` — created at first launch if missing
