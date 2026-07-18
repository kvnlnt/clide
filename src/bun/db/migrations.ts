import { Database } from "bun:sqlite";

/**
 * Create the runs table and apply any additive migrations. Idempotent — safe to
 * run on every launch.
 */
export function migrate(db: Database): void {
  db.run(`
		CREATE TABLE IF NOT EXISTS runs (
			id TEXT PRIMARY KEY,
			form_slug TEXT NOT NULL,
			inputs TEXT NOT NULL,
			status TEXT NOT NULL,
			exit_code INTEGER,
			started_at TEXT NOT NULL,
			finished_at TEXT,
			output_path TEXT
		);
	`);

  // Additive columns from ticket 11. SQLite has no "ADD COLUMN IF NOT EXISTS",
  // so we inspect the table first.
  const existing = new Set((db.query("PRAGMA table_info(runs)").all() as { name: string }[]).map((c) => c.name));

  const additions: Record<string, string> = {
    pinned: "ALTER TABLE runs ADD COLUMN pinned INTEGER DEFAULT 0",
    scheduled_at: "ALTER TABLE runs ADD COLUMN scheduled_at TEXT",
    repeat_interval: "ALTER TABLE runs ADD COLUMN repeat_interval TEXT",
    // Ticket 23: provenance of event-bus auto-submitted runs (JSON RunTrigger).
    triggered_by: "ALTER TABLE runs ADD COLUMN triggered_by TEXT",
    // Ticket 52: resolved tool + argv for command-backed forms (JSON { tool, argv }).
    resolved_command: "ALTER TABLE runs ADD COLUMN resolved_command TEXT",
    // Ticket 97: when the run was marked read (ISO timestamp).
    read_at: "ALTER TABLE runs ADD COLUMN read_at TEXT",
    // Ticket 98: AI-generated one-line status report.
    summary: "ALTER TABLE runs ADD COLUMN summary TEXT",
  };

  for (const [column, sql] of Object.entries(additions)) {
    if (!existing.has(column)) db.run(sql);
  }

  db.run(`CREATE INDEX IF NOT EXISTS idx_runs_form ON runs(form_slug);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_runs_started ON runs(started_at);`);
}
