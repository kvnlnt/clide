import { join } from "node:path";
import type { Interpreter, OutputChunk, RunRecord, RunStatusUpdate, RunTrigger } from "../../shared/types";
import { createRun, getRun, setOutputPath, updateRunStatus } from "../db/history";
import { publishRunEvents } from "../events/bus";
import { loadFormFolder } from "../forms/loader";
import { formDir } from "../paths";
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

/**
 * Create a run record and start executing it. Returns the run id immediately;
 * execution continues asynchronously, streaming output through `emitters`.
 */
export async function startRun(
  projectPath: string,
  projectName: string,
  formSlug: string,
  inputs: Record<string, unknown>,
  emitters: RunEmitters,
  existingRunId?: string,
  triggeredBy?: RunTrigger,
): Promise<{ runId: string }> {
  const folder = await loadFormFolder(projectPath, formSlug, projectName);
  if (!folder) {
    throw new Error(`Form not found: ${formSlug}`);
  }

  const runId = existingRunId ?? crypto.randomUUID();
  const startedAt = new Date().toISOString();

  if (existingRunId && getRun(existingRunId)) {
    updateRunStatus(runId, "running", null, null);
  } else {
    createRun(projectPath, {
      id: runId,
      formSlug,
      inputs,
      status: "running",
      startedAt,
      triggeredBy: triggeredBy ?? null,
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
  void execute(
    projectPath,
    projectName,
    runId,
    folder.form.scriptFile,
    folder.meta.interpreter ?? "bash",
    formSlug,
    inputs,
    emitters,
  );

  return { runId };
}

async function execute(
  projectPath: string,
  projectName: string,
  runId: string,
  scriptFile: string,
  interpreter: Interpreter,
  formSlug: string,
  inputs: Record<string, unknown>,
  emitters: RunEmitters,
): Promise<void> {
  const folder = await loadFormFolder(projectPath, formSlug, projectName);
  if (!folder) return;

  const scriptPath = join(formDir(projectPath, formSlug), scriptFile);
  const args = buildArgs(folder.form, inputs);
  const cmd = INTERPRETER_CMD[interpreter] ?? "bash";
  const capture = new OutputCapture(projectPath, runId);

  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn([cmd, scriptPath, ...args], {
      stdout: "pipe",
      stderr: "pipe",
      cwd: formDir(projectPath, formSlug),
    });
  } catch (err) {
    finishWithError(runId, emitters, `Failed to spawn: ${String(err)}`);
    return;
  }

  registry.register(runId, proc);

  const decoder = new TextDecoder();

  async function pump(stream: ReadableStream<Uint8Array> | undefined, type: "stdout" | "stderr"): Promise<void> {
    if (!stream) return;
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      if (type === "stdout") capture.append(text);
      emitters.emitChunk({ runId, type, data: text, timestamp: Date.now() });
    }
  }

  const pumpStdout = pump(proc.stdout as ReadableStream<Uint8Array> | undefined, "stdout");
  const pumpStderr = pump(proc.stderr as ReadableStream<Uint8Array> | undefined, "stderr");

  const exitCode = await proc.exited;
  await Promise.all([pumpStdout, pumpStderr]);
  registry.unregister(runId);

  const finishedAt = new Date().toISOString();
  const outputPath = await capture.flush();
  setOutputPath(runId, outputPath);

  // A cancelled process is killed and already marked error; don't override.
  const current = getRun(runId);
  if (current?.status === "error" && current.exitCode === 130) {
    return;
  }

  const status = exitCode === 0 ? "success" : "error";
  updateRunStatus(runId, status, exitCode, finishedAt);
  emitters.emitStatus({ runId, status, exitCode, finishedAt });

  // Fire the form's declared events on the internal bus (ticket 23).
  if (status === "success") {
    const emits = folder.form.events?.emits ?? [];
    if (emits.length > 0) {
      publishRunEvents({ runId, formSlug }, emits, capture.text, folder.form.outputType);
    }
  }
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
