import { join } from "node:path";
import { buildCommand } from "../../shared/command";
import type { FormDefinition, Interpreter, OutputChunk, RunRecord, RunStatusUpdate, RunTrigger } from "../../shared/types";
import { createRun, getRun, setOutputPath, setResolvedCommand, updateRunStatus } from "../db/history";
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
  if (folder.form.command) {
    void executeCommand(projectPath, projectName, runId, formSlug, inputs, emitters);
  } else {
    void executeScript(
      projectPath,
      projectName,
      runId,
      folder.form.scriptFile ?? "script.sh",
      folder.meta.interpreter ?? "bash",
      formSlug,
      inputs,
      emitters,
    );
  }

  return { runId };
}

/** Runs a command-backed form (ticket 52): spawns its tool directly, no interpreter, no script file. */
async function executeCommand(
  projectPath: string,
  projectName: string,
  runId: string,
  formSlug: string,
  inputs: Record<string, unknown>,
  emitters: RunEmitters,
): Promise<void> {
  const folder = await loadFormFolder(projectPath, formSlug, projectName);
  if (!folder?.form.command) return;

  const built = buildCommand(folder.form, inputs);
  const resolvedPath = Bun.which(built.tool);
  if (!resolvedPath) {
    finishWithError(runId, emitters, `Tool not installed: "${built.tool}" is not on PATH.`);
    return;
  }
  setResolvedCommand(runId, built.tool, built.argv);

  const capture = new OutputCapture(projectPath, runId);

  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn([resolvedPath, ...built.argv], {
      stdout: "pipe",
      stderr: "pipe",
      stdin: built.stdin !== undefined ? new TextEncoder().encode(built.stdin) : undefined,
      env: Object.keys(built.env).length > 0 ? { ...process.env, ...built.env } : undefined,
    });
  } catch (err) {
    finishWithError(runId, emitters, `Failed to spawn: ${String(err)}`);
    return;
  }

  registry.register(runId, proc);
  await pumpAndFinish(proc, runId, formSlug, capture, folder.form, emitters);
}

async function executeScript(
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
  await pumpAndFinish(proc, runId, formSlug, capture, folder.form, emitters);
}

async function pumpAndFinish(
  proc: ReturnType<typeof Bun.spawn>,
  runId: string,
  formSlug: string,
  capture: OutputCapture,
  form: FormDefinition,
  emitters: RunEmitters,
): Promise<void> {
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

  // Fire the form's declared events on the internal bus (ticket 23), carrying
  // any file artifacts this run produced (ticket 56).
  if (status === "success") {
    const emits = form.events?.emits ?? [];
    if (emits.length > 0) {
      const artifacts = await collectArtifacts(capture.text, form.outputType);
      publishRunEvents({ runId, formSlug }, emits, capture.text, form.outputType, artifacts);
    }
  }
}

/**
 * File paths a run produced, for the event bus's "artifacts" (ticket 56):
 * for image/audio/video outputs, the last printed line (the established
 * convention — see `readOutputFile`); plus any other line that's itself an
 * existing absolute path. Deliberately simple — not a general-purpose parser.
 */
async function collectArtifacts(text: string, outputType: FormDefinition["outputType"]): Promise<string[]> {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("/"));
  const candidates = new Set(lines);
  if (outputType === "image" || outputType === "audio" || outputType === "video") {
    const last = lines[lines.length - 1];
    if (last) candidates.add(last);
  }
  const artifacts: string[] = [];
  for (const candidate of Array.from(candidates).slice(0, 20)) {
    try {
      if (await Bun.file(candidate).exists()) artifacts.push(candidate);
    } catch {
      /* not a real path — skip */
    }
  }
  return artifacts;
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
