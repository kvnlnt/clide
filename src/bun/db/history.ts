import { Database } from "bun:sqlite";
import type { RepeatInterval, RunArtifact, RunRecord, RunStatus } from "../../shared/types";
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
  resolved_command: string | null;
  triggered_by: string | null;
  read_at: string | null;
  summary: string | null;
  form_version: number;
  skip_dates: string | null;
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

/** DISK FORMAT FIREWALL (ticket 96): DB column `form_slug` maps to RunRecord.taskSlug */
function rowToRecord(row: RunRow): RunRecord {
  let inputs: Record<string, unknown> = {};
  try {
    inputs = JSON.parse(row.inputs);
  } catch {
    inputs = {};
  }
  let command: RunRecord["command"] = null;
  if (row.resolved_command) {
    try {
      const parsed = JSON.parse(row.resolved_command) as { tool: string; argv: string[] };
      if (typeof parsed?.tool === "string" && Array.isArray(parsed?.argv)) command = parsed;
    } catch {
      command = null;
    }
  }
  let triggeredBy: unknown = null;
  if (row.triggered_by) {
    try {
      triggeredBy = JSON.parse(row.triggered_by);
    } catch {
      triggeredBy = null;
    }
  }
  let skipDates: string[] = [];
  if (row.skip_dates) {
    try {
      const parsed = JSON.parse(row.skip_dates);
      if (Array.isArray(parsed)) skipDates = parsed.filter((d): d is string => typeof d === "string");
    } catch {
      skipDates = [];
    }
  }
  return {
    id: row.id,
    taskSlug: row.form_slug, // Disk: form_slug → Memory: taskSlug
    inputs,
    status: row.status as RunStatus,
    exitCode: row.exit_code,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    outputPath: row.output_path,
    pinned: row.pinned === 1,
    scheduledAt: row.scheduled_at,
    repeatInterval: (row.repeat_interval as RepeatInterval | null) ?? null,
    skipDates,
    command,
    readAt: row.read_at,
    triggeredBy,
    summary: row.summary,
    taskVersion: row.form_version ?? 1, // Disk: form_version → Memory: taskVersion
  };
}

export interface CreateRunInput {
  id: string;
  taskSlug: string; // Memory: taskSlug → written to disk as form_slug
  inputs: Record<string, unknown>;
  status: RunStatus;
  startedAt: string;
  outputPath?: string | null;
  scheduledAt?: string | null;
  repeatInterval?: RepeatInterval | null;
  /** Future occurrence ISO timestamps excluded from this series' projection (ticket 129), carried forward across fires. */
  skipDates?: string[];
  triggeredBy?: unknown;
  /** When not null, the run is created pre-read (ticket 97). */
  readAt?: string | null;
  /** Task version executed (ticket 105). */
  taskVersion?: number;
}

export function createRun(projectPath: string, input: CreateRunInput): RunRecord {
  getDb(projectPath).run(
    `INSERT INTO runs (id, form_slug, inputs, status, started_at, output_path, scheduled_at, repeat_interval, pinned, triggered_by, read_at, form_version, skip_dates)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    [
      input.id,
      input.taskSlug, // Memory: taskSlug → Disk: form_slug column
      JSON.stringify(input.inputs),
      input.status,
      input.startedAt,
      input.outputPath ?? null,
      input.scheduledAt ?? null,
      input.repeatInterval ?? null,
      input.triggeredBy ? JSON.stringify(input.triggeredBy) : null,
      input.readAt ?? null,
      input.taskVersion ?? 1, // Memory: taskVersion → Disk: form_version column
      JSON.stringify(input.skipDates ?? []),
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

/** Change a pending scheduled run's fire time/repeat interval. */
export function updateRunSchedule(id: string, scheduledAt: string, repeatInterval: RepeatInterval): void {
  const projectPath = runIndex.get(id);
  if (!projectPath) return;
  getDb(projectPath).run(`UPDATE runs SET scheduled_at = ?, repeat_interval = ? WHERE id = ?`, [
    scheduledAt,
    repeatInterval,
    id,
  ]);
}

/** Persist a recurring run's set of excluded future occurrence timestamps (ticket 129). */
export function setSkipDates(id: string, skipDates: string[]): void {
  const projectPath = runIndex.get(id);
  if (!projectPath) return;
  getDb(projectPath).run(`UPDATE runs SET skip_dates = ? WHERE id = ?`, [JSON.stringify(skipDates), id]);
}

export function setOutputPath(id: string, outputPath: string): void {
  const projectPath = runIndex.get(id);
  if (!projectPath) return;
  getDb(projectPath).run(`UPDATE runs SET output_path = ? WHERE id = ?`, [outputPath, id]);
}

/** Records the exact tool + argv a command-backed run executed (ticket 52). */
export function setResolvedCommand(id: string, tool: string, argv: string[]): void {
  const projectPath = runIndex.get(id);
  if (!projectPath) return;
  getDb(projectPath).run(`UPDATE runs SET resolved_command = ? WHERE id = ?`, [JSON.stringify({ tool, argv }), id]);
}

export function setPinned(id: string, pinned: boolean): void {
  const projectPath = runIndex.get(id);
  if (!projectPath) return;
  getDb(projectPath).run(`UPDATE runs SET pinned = ? WHERE id = ?`, [pinned ? 1 : 0, id]);
}

/** Mark runs as read (ticket 97). */
export function markRunsRead(runIds: string[]): void {
  if (runIds.length === 0) return;
  const now = new Date().toISOString();
  // Group by project to batch updates.
  const byProject = new Map<string, string[]>();
  for (const id of runIds) {
    const projectPath = runIndex.get(id);
    if (!projectPath) continue;
    if (!byProject.has(projectPath)) byProject.set(projectPath, []);
    byProject.get(projectPath)!.push(id);
  }
  for (const [projectPath, ids] of byProject) {
    const placeholders = ids.map(() => "?").join(", ");
    getDb(projectPath).run(`UPDATE runs SET read_at = ? WHERE id IN (${placeholders})`, [now, ...ids]);
  }
}

/** Mark all unread runs in a project as read (ticket 97 toggle-on bulk-mark). */
export function markAllRunsRead(projectPath: string): void {
  const now = new Date().toISOString();
  getDb(projectPath).run(`UPDATE runs SET read_at = ? WHERE read_at IS NULL`, [now]);
}

/** Set AI-generated summary for a run (ticket 98). */
export function setSummary(id: string, summary: string): void {
  const projectPath = runIndex.get(id);
  if (!projectPath) return;
  getDb(projectPath).run(`UPDATE runs SET summary = ? WHERE id = ?`, [summary, id]);
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

export function getRunHistory(projectPath: string, taskSlug: string, limit: number): RunRecord[] {
  const rows = getDb(projectPath)
    .query(`SELECT * FROM runs WHERE form_slug = ? ORDER BY started_at DESC LIMIT ?`)
    .all(taskSlug, limit) as RunRow[];
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

// Run artifacts (ticket 102) -------------------------------------------------

interface ArtifactRow {
  run_id: string;
  uri: string;
  name: string;
  kind: string;
  size: number | null;
  mime: string | null;
  source: string;
}

function rowToArtifact(row: ArtifactRow): RunArtifact {
  return {
    runId: row.run_id,
    uri: row.uri,
    name: row.name,
    kind: row.kind as RunArtifact["kind"],
    size: row.size ?? undefined,
    mime: row.mime ?? undefined,
    source: row.source as RunArtifact["source"],
  };
}

/** Add a run artifact (ticket 102). */
export function addRunArtifact(projectPath: string, artifact: RunArtifact): void {
  const db = getDb(projectPath);
  db.run(`INSERT INTO run_artifacts (run_id, uri, name, kind, size, mime, source) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
    artifact.runId,
    artifact.uri,
    artifact.name,
    artifact.kind,
    artifact.size ?? null,
    artifact.mime ?? null,
    artifact.source,
  ]);
}

/** Batch-add run artifacts (ticket 102). */
export function addRunArtifacts(projectPath: string, artifacts: RunArtifact[]): void {
  const db = getDb(projectPath);
  const insert = db.prepare(
    `INSERT INTO run_artifacts (run_id, uri, name, kind, size, mime, source) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const artifact of artifacts) {
    insert.run(
      artifact.runId,
      artifact.uri,
      artifact.name,
      artifact.kind,
      artifact.size ?? null,
      artifact.mime ?? null,
      artifact.source,
    );
  }
}

/** Get all artifacts for a run (ticket 102). */
export function getRunArtifacts(runId: string): RunArtifact[] {
  const projectPath = resolveRunProject(runId);
  if (!projectPath) return [];
  const db = getDb(projectPath);
  const rows = db.query(`SELECT * FROM run_artifacts WHERE run_id = ? ORDER BY name`).all(runId) as ArtifactRow[];
  return rows.map(rowToArtifact);
}
