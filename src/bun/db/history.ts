import { Database } from "bun:sqlite";
import type { RepeatInterval, RunRecord, RunStatus, RunTrigger } from "../../shared/types";
import { ensureProjectDirs, projectHistoryDb } from "../paths";
import { migrate } from "./migrations";

interface RunRow {
  id: string;
  form_slug: string;
  inputs: string;
  status: string;
  exit_code: number | null;
  started_at: string;
  finished_at: string | null;
  output_path: string | null;
  pinned: number;
  scheduled_at: string | null;
  repeat_interval: string | null;
  triggered_by: string | null;
}

/** projectPath -> open Database. */
const dbs = new Map<string, Database>();
/** runId -> projectPath, so runId-only operations can find the right DB. */
const runIndex = new Map<string, string>();

function getDb(projectPath: string): Database {
  let db = dbs.get(projectPath);
  if (!db) {
    ensureProjectDirs(projectPath);
    db = new Database(projectHistoryDb(projectPath));
    db.run("PRAGMA journal_mode = WAL;");
    migrate(db);
    dbs.set(projectPath, db);
  }
  return db;
}

/** Resolve which project's DB a run lives in. */
export function resolveRunProject(runId: string): string | null {
  return runIndex.get(runId) ?? null;
}

/** Populate the runId -> project index by scanning each project's DB. */
export function indexRuns(projectPaths: string[]): void {
  runIndex.clear();
  for (const projectPath of projectPaths) {
    try {
      const rows = getDb(projectPath).query("SELECT id FROM runs").all() as { id: string }[];
      for (const row of rows) runIndex.set(row.id, projectPath);
    } catch {
      /* ignore unreadable project DBs */
    }
  }
}

function rowToRecord(row: RunRow): RunRecord {
  let inputs: Record<string, unknown> = {};
  try {
    inputs = JSON.parse(row.inputs);
  } catch {
    inputs = {};
  }
  let triggeredBy: RunTrigger | null = null;
  if (row.triggered_by) {
    try {
      const parsed = JSON.parse(row.triggered_by) as RunTrigger;
      if (typeof parsed?.event === "string" && typeof parsed?.sourceRunId === "string") triggeredBy = parsed;
    } catch {
      triggeredBy = null;
    }
  }
  return {
    id: row.id,
    formSlug: row.form_slug,
    inputs,
    status: row.status as RunStatus,
    exitCode: row.exit_code,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    outputPath: row.output_path,
    pinned: row.pinned === 1,
    scheduledAt: row.scheduled_at,
    repeatInterval: (row.repeat_interval as RepeatInterval | null) ?? null,
    triggeredBy,
  };
}

export interface CreateRunInput {
  id: string;
  formSlug: string;
  inputs: Record<string, unknown>;
  status: RunStatus;
  startedAt: string;
  outputPath?: string | null;
  scheduledAt?: string | null;
  repeatInterval?: RepeatInterval | null;
  triggeredBy?: RunTrigger | null;
}

export function createRun(projectPath: string, input: CreateRunInput): RunRecord {
  getDb(projectPath).run(
    `INSERT INTO runs (id, form_slug, inputs, status, started_at, output_path, scheduled_at, repeat_interval, pinned, triggered_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      input.id,
      input.formSlug,
      JSON.stringify(input.inputs),
      input.status,
      input.startedAt,
      input.outputPath ?? null,
      input.scheduledAt ?? null,
      input.repeatInterval ?? null,
      input.triggeredBy ? JSON.stringify(input.triggeredBy) : null,
    ],
  );
  runIndex.set(input.id, projectPath);
  return getRun(input.id)!;
}

export function updateRunStatus(
  id: string,
  status: RunStatus,
  exitCode: number | null,
  finishedAt: string | null,
): void {
  const projectPath = runIndex.get(id);
  if (!projectPath) return;
  getDb(projectPath).run(`UPDATE runs SET status = ?, exit_code = ?, finished_at = ? WHERE id = ?`, [
    status,
    exitCode,
    finishedAt,
    id,
  ]);
}

export function setOutputPath(id: string, outputPath: string): void {
  const projectPath = runIndex.get(id);
  if (!projectPath) return;
  getDb(projectPath).run(`UPDATE runs SET output_path = ? WHERE id = ?`, [outputPath, id]);
}

export function setPinned(id: string, pinned: boolean): void {
  const projectPath = runIndex.get(id);
  if (!projectPath) return;
  getDb(projectPath).run(`UPDATE runs SET pinned = ? WHERE id = ?`, [pinned ? 1 : 0, id]);
}

export function deleteRun(id: string): void {
  const projectPath = runIndex.get(id);
  if (!projectPath) return;
  getDb(projectPath).run(`DELETE FROM runs WHERE id = ?`, [id]);
  runIndex.delete(id);
}

export function getRun(id: string): RunRecord | null {
  const projectPath = runIndex.get(id);
  if (!projectPath) return null;
  const row = getDb(projectPath).query(`SELECT * FROM runs WHERE id = ?`).get(id) as RunRow | null;
  return row ? rowToRecord(row) : null;
}

export function getRunHistory(projectPath: string, formSlug: string, limit: number): RunRecord[] {
  const rows = getDb(projectPath)
    .query(`SELECT * FROM runs WHERE form_slug = ? ORDER BY started_at DESC LIMIT ?`)
    .all(formSlug, limit) as RunRow[];
  return rows.map(rowToRecord);
}

/** All runs across the given project folders, newest first. */
export function getAllRuns(projectPaths: string[]): RunRecord[] {
  const all: RunRecord[] = [];
  for (const projectPath of projectPaths) {
    try {
      const rows = getDb(projectPath).query(`SELECT * FROM runs ORDER BY started_at DESC`).all() as RunRow[];
      all.push(...rows.map(rowToRecord));
    } catch {
      /* ignore */
    }
  }
  all.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return all;
}

/** Scheduled runs that are still pending, paired with their project path. */
export function getPendingScheduledRuns(projectPaths: string[]): { run: RunRecord; projectPath: string }[] {
  const out: { run: RunRecord; projectPath: string }[] = [];
  for (const projectPath of projectPaths) {
    try {
      const rows = getDb(projectPath)
        .query(`SELECT * FROM runs WHERE status = 'scheduled' AND scheduled_at IS NOT NULL ORDER BY scheduled_at ASC`)
        .all() as RunRow[];
      for (const row of rows) out.push({ run: rowToRecord(row), projectPath });
    } catch {
      /* ignore */
    }
  }
  return out;
}
