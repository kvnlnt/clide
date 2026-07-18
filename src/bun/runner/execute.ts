import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildCommand, formatCommandPreview } from "../../shared/command";
import { evaluateOutputs } from "../../shared/outputs";
import type {
  Interpreter,
  OutputChunk,
  OutputResult,
  RunRecord,
  RunStatusUpdate,
  TaskFolder,
} from "../../shared/types";
import { createRun, getRun, setOutputPath, setResolvedCommand, updateRunStatus } from "../db/history";
import { formDir, runDir } from "../paths";
import { loadTaskFolder } from "../tasks/loader";
import { buildArgs } from "./argBuilder";
import { OutputCapture } from "./outputCapture";
import * as registry from "./registry";

export interface RunEmitters {
  emitChunk: (chunk: OutputChunk) => void;
  emitStatus: (update: RunStatusUpdate) => void;
}

const INTERPRETER_CMD: Record<Interpreter, string> = {
  bash: "bash",
  python3: "python3",
  node: "node",
  bun: "bun",
};

/** Cap in-memory stderr accumulation (streaming to the UI is unaffected). */
const MAX_CAPTURE_CHARS = 256 * 1024;

/**
 * Fired when a standalone (user/scheduler-initiated) form run completes
 * successfully — the workflow form-submitted trigger hook (ticket 90).
 * Replaces the event bus: nothing implicit, one explicit listener.
 */
export interface RunCompletionInfo {
  projectPath: string;
  projectName: string;
  taskSlug: string;
  runId: string;
  exitCode: number | null;
  inputs: Record<string, unknown>;
  stdout: string;
  stderr: string;
  outputs: OutputResult[];
}

let completionListener: ((info: RunCompletionInfo) => void) | null = null;

export function setRunCompletionListener(fn: (info: RunCompletionInfo) => void): void {
  completionListener = fn;
}

/**
 * Create a run record and start executing it. Returns the run id immediately;
 * execution continues asynchronously, streaming output through `emitters`.
 */
export async function startRun(
  projectPath: string,
  projectName: string,
  taskSlug: string,
  inputs: Record<string, unknown>,
  emitters: RunEmitters,
  existingRunId?: string,
): Promise<{ runId: string }> {
  const folder = await loadTaskFolder(projectPath, taskSlug, projectName);
  if (!folder) {
    throw new Error(`Form not found: ${taskSlug}`);
  }

  const runId = existingRunId ?? crypto.randomUUID();
  const startedAt = new Date().toISOString();

  if (existingRunId && getRun(existingRunId)) {
    updateRunStatus(runId, "running", null, null);
  } else {
    createRun(projectPath, {
      id: runId,
      taskSlug,
      inputs,
      status: "running",
      startedAt,
    });
  }

  if (registry.isRunning(runId)) {
    // Guard: never start a second instance for the same run.
    return { runId };
  }

  emitters.emitStatus({
    runId,
    status: "running",
    exitCode: null,
    finishedAt: null,
  });

  // Fire-and-forget the actual execution.
  void execute(projectPath, projectName, runId, folder, inputs, emitters);

  return { runId };
}

/** Spawns a form's process — direct tool invocation for command forms, interpreter+script for legacy. */
function spawnForm(
  folder: TaskFolder,
  inputs: Record<string, unknown>,
): {
  proc: ReturnType<typeof Bun.spawn>;
  commandDisplay: string;
  argv?: { tool: string; argv: string[] };
} {
  if (folder.task.command) {
    const built = buildCommand(folder.task, inputs);
    const resolvedPath = Bun.which(built.tool);
    if (!resolvedPath) {
      throw new Error(`Tool not installed: "${built.tool}" is not on PATH.`);
    }
    const proc = Bun.spawn([resolvedPath, ...built.argv], {
      stdout: "pipe",
      stderr: "pipe",
      stdin: built.stdin !== undefined ? new TextEncoder().encode(built.stdin) : undefined,
      env: Object.keys(built.env).length > 0 ? { ...process.env, ...built.env } : undefined,
    });
    return {
      proc,
      commandDisplay: formatCommandPreview(built.tool, built.argv),
      argv: { tool: built.tool, argv: built.argv },
    };
  }

  const scriptFile = folder.task.scriptFile ?? "script.sh";
  const scriptPath = join(formDir(folder.projectPath, folder.meta.slug), scriptFile);
  const args = buildArgs(folder.task, inputs);
  const cmd = INTERPRETER_CMD[folder.meta.interpreter ?? "bash"] ?? "bash";
  const proc = Bun.spawn([cmd, scriptPath, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    cwd: formDir(folder.projectPath, folder.meta.slug),
  });
  return { proc, commandDisplay: formatCommandPreview(cmd, [scriptPath, ...args]) };
}

async function execute(
  projectPath: string,
  projectName: string,
  runId: string,
  folder: TaskFolder,
  inputs: Record<string, unknown>,
  emitters: RunEmitters,
): Promise<void> {
  const capture = new OutputCapture(projectPath, runId);

  let spawned: ReturnType<typeof spawnForm>;
  try {
    spawned = spawnForm(folder, inputs);
  } catch (err) {
    finishWithError(runId, emitters, err instanceof Error ? err.message : `Failed to spawn: ${String(err)}`);
    return;
  }
  if (spawned.argv) setResolvedCommand(runId, spawned.argv.tool, spawned.argv.argv);

  registry.register(runId, spawned.proc);

  const decoder = new TextDecoder();
  let stderrText = "";

  async function pump(stream: ReadableStream<Uint8Array> | undefined, type: "stdout" | "stderr"): Promise<void> {
    if (!stream) return;
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      if (type === "stdout") capture.append(text);
      else if (stderrText.length < MAX_CAPTURE_CHARS) stderrText += text;
      emitters.emitChunk({ runId, type, data: text, timestamp: Date.now() });
    }
  }

  const pumpStdout = pump(spawned.proc.stdout as ReadableStream<Uint8Array> | undefined, "stdout");
  const pumpStderr = pump(spawned.proc.stderr as ReadableStream<Uint8Array> | undefined, "stderr");

  const exitCode = await spawned.proc.exited;
  await Promise.all([pumpStdout, pumpStderr]);
  registry.unregister(runId);

  const finishedAt = new Date().toISOString();
  const outputPath = await capture.flush();
  setOutputPath(runId, outputPath);

  // Evaluate + persist named output definitions (ticket 86) — never blocks
  // or fails the run itself.
  let outputs: OutputResult[] = [];
  try {
    outputs = evaluateOutputs(folder.task.outputs ?? [], { stdout: capture.text, stderr: stderrText }, existsSync);
    await Bun.write(join(runDir(projectPath, runId), "outputs.json"), JSON.stringify(outputs, null, 2));
  } catch (err) {
    console.warn(`[outputs] evaluation failed for ${runId}:`, err);
  }

  // A cancelled process is killed and already marked error; don't override.
  const current = getRun(runId);
  if (current?.status === "error" && current.exitCode === 130) {
    return;
  }

  const status = exitCode === 0 ? "success" : "error";
  updateRunStatus(runId, status, exitCode, finishedAt);
  emitters.emitStatus({ runId, status, exitCode, finishedAt });

  // Workflow form-submitted triggers (ticket 90) fire on successful
  // standalone completion — outputs exist by now, which is the point.
  if (status === "success" && completionListener) {
    completionListener({
      projectPath,
      projectName,
      taskSlug: folder.meta.slug,
      runId,
      exitCode,
      inputs,
      stdout: capture.text,
      stderr: stderrText,
      outputs,
    });
  }
}

/** Reads the persisted output-definition results for a run (ticket 86). */
export async function readRunOutputs(projectPath: string, runId: string): Promise<OutputResult[]> {
  try {
    const file = Bun.file(join(runDir(projectPath, runId), "outputs.json"));
    if (!(await file.exists())) return [];
    const parsed = JSON.parse(await file.text());
    return Array.isArray(parsed) ? (parsed as OutputResult[]) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// One-shot execution for workflow form steps (ticket 89): same spawn path as
// standalone runs — the single-compiler rule — but no history DB record, no
// thread card, no completion trigger (workflow steps never cascade).
// ---------------------------------------------------------------------------

export interface ExecOnceResult {
  commandDisplay: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  outputs: OutputResult[];
  durationMs: number;
}

export async function execFormOnce(
  folder: TaskFolder,
  inputs: Record<string, unknown>,
  /** Registry key for cancellation (the workflow run id); optional. */
  procKey?: string,
): Promise<ExecOnceResult> {
  const started = Date.now();
  const spawned = spawnForm(folder, inputs); // throws on tool-not-installed; caller records the failure

  if (procKey) registry.register(procKey, spawned.proc);

  const decoder = new TextDecoder();
  let stdout = "";
  let stderr = "";
  const pump = async (stream: ReadableStream<Uint8Array> | undefined, sink: (t: string) => void) => {
    if (!stream) return;
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sink(decoder.decode(value));
    }
  };
  const p1 = pump(spawned.proc.stdout as ReadableStream<Uint8Array> | undefined, (t) => {
    if (stdout.length < MAX_CAPTURE_CHARS) stdout += t;
  });
  const p2 = pump(spawned.proc.stderr as ReadableStream<Uint8Array> | undefined, (t) => {
    if (stderr.length < MAX_CAPTURE_CHARS) stderr += t;
  });

  const exitCode = await spawned.proc.exited;
  await Promise.all([p1, p2]);
  if (procKey) registry.unregister(procKey);

  const outputs = evaluateOutputs(folder.task.outputs ?? [], { stdout, stderr }, existsSync);
  return {
    commandDisplay: spawned.commandDisplay,
    stdout,
    stderr,
    exitCode,
    outputs,
    durationMs: Date.now() - started,
  };
}

function finishWithError(runId: string, emitters: RunEmitters, message: string): void {
  const finishedAt = new Date().toISOString();
  updateRunStatus(runId, "error", 1, finishedAt);
  emitters.emitChunk({
    runId,
    type: "stderr",
    data: message,
    timestamp: Date.now(),
  });
  emitters.emitStatus({ runId, status: "error", exitCode: 1, finishedAt });
}

/** Kill a running process and mark the run as cancelled. */
export function cancelRun(runId: string, emitters: RunEmitters): void {
  const proc = registry.get(runId);
  if (proc) {
    try {
      proc.kill();
    } catch {
      /* ignore */
    }
  }
  registry.unregister(runId);
  const finishedAt = new Date().toISOString();
  updateRunStatus(runId, "error", 130, finishedAt);
  emitters.emitChunk({
    runId,
    type: "stderr",
    data: "Run cancelled.",
    timestamp: Date.now(),
  });
  emitters.emitStatus({ runId, status: "error", exitCode: 130, finishedAt });
}

export type { RunRecord };
