import { buildCommand, formatCommandPreview } from "../../shared/command";
import type {
  TaskStep,
  Workflow,
  WorkflowPlanEntry,
  WorkflowRun,
  WorkflowRunTriggerInfo,
  WorkflowStep,
  WorkflowStepRecord,
} from "../../shared/types";
import { ITEM_NAME, TRIGGER_NAME, evalExpressionString, isTruthy, resolveTemplate } from "../../shared/workflowExpr";
import { fallbackWorkflowSummary, generateWorkflowSummary } from "../ai/runSummary";
import { execFormOnce } from "../runner/execute";
import * as procRegistry from "../runner/registry";
import { loadTaskFolder } from "../tasks/loader";
import { saveRun } from "./runStore";

// ---------------------------------------------------------------------------
// Workflow execution engine (ticket 89). Sequential per list; parallel steps
// run concurrently and rejoin; decisions/loops evaluate via the shared
// expression module. Form steps go through the SAME buildCommand/spawn path
// as standalone runs (execFormOnce) — preview, dry run, and execution can
// never disagree. Failure policy v1: a failed step halts the workflow and
// the rest are marked skipped.
// ---------------------------------------------------------------------------

interface RunHandle {
  cancelled: boolean;
  /** Registry keys of live step processes, for cancellation. */
  procKeys: Set<string>;
}

const activeRuns = new Map<string, RunHandle>();

interface EngineCtx {
  projectPath: string;
  projectName: string;
  run: WorkflowRun;
  handle: RunHandle;
  onUpdate: (run: WorkflowRun) => void;
  procSeq: number;
}

/** Persist + push the current run state. Best-effort; never throws into the walk. */
async function publish(ctx: EngineCtx): Promise<void> {
  try {
    await saveRun(ctx.projectPath, ctx.run);
  } catch (err) {
    console.warn(`[workflow] failed to persist run ${ctx.run.runId}:`, err);
  }
  try {
    ctx.onUpdate(ctx.run);
  } catch {
    /* renderer gone — fine */
  }
}

type Env = Record<string, unknown>;

/** Named-output map for the env: only successful extractions are addressable. */
function outputsToEnv(outputs: { name: string; ok: boolean; value?: unknown }[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const o of outputs) if (o.ok) out[o.name] = o.value;
  return out;
}

/** Recursively records an entire sub-tree as skipped, so the trace shows why nothing ran. */
function pushSkippedTree(ctx: EngineCtx, steps: WorkflowStep[], depth: number, note: string, suffix = ""): void {
  for (const step of steps) {
    ctx.run.records.push({ name: step.name + suffix, type: step.type, status: "skipped", depth, note });
    if (step.type === "decision") {
      pushSkippedTree(ctx, step.then, depth + 1, note, suffix);
      pushSkippedTree(ctx, step.else ?? [], depth + 1, note, suffix);
    } else if (step.type === "loop") {
      pushSkippedTree(ctx, step.steps, depth + 1, note, suffix);
    } else if (step.type === "parallel") {
      for (const branch of step.branches) pushSkippedTree(ctx, branch, depth + 1, note, suffix);
    }
  }
}

async function runFormStep(ctx: EngineCtx, step: TaskStep, env: Env, depth: number, suffix: string): Promise<boolean> {
  const record: WorkflowStepRecord = { name: step.name + suffix, type: "form", status: "running", depth };
  ctx.run.records.push(record);
  await publish(ctx);

  // Resolve every input template against the current scope.
  const resolved: Record<string, unknown> = {};
  for (const [fieldId, template] of Object.entries(step.inputs)) {
    const res = resolveTemplate(template, env);
    if (!res.ok) {
      record.status = "failed";
      record.note = `couldn't resolve input "${fieldId}": ${res.error}`;
      await publish(ctx);
      return false;
    }
    resolved[fieldId] = res.value;
  }
  record.resolvedInputs = resolved;

  const folder = await loadTaskFolder(ctx.projectPath, step.taskSlug, ctx.projectName);
  if (!folder) {
    record.status = "failed";
    record.note = `form not found: ${step.taskSlug}`;
    await publish(ctx);
    return false;
  }

  const procKey = `${ctx.run.runId}:${ctx.procSeq++}`;
  ctx.handle.procKeys.add(procKey);
  try {
    const result = await execFormOnce(folder, resolved, procKey);
    record.command = result.commandDisplay;
    record.stdout = result.stdout;
    record.stderr = result.stderr;
    record.exitCode = result.exitCode;
    record.durationMs = result.durationMs;
    record.outputs = result.outputs;
    if (ctx.handle.cancelled) {
      record.status = "failed";
      record.note = "cancelled";
      await publish(ctx);
      return false;
    }
    if (result.exitCode !== 0) {
      record.status = "failed";
      await publish(ctx);
      return false;
    }
    record.status = "succeeded";
    // Address this step's results by its plain name (loop suffix is trace-only).
    env[step.name] = {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      outputs: outputsToEnv(result.outputs),
    };
    await publish(ctx);
    return true;
  } catch (err) {
    record.status = "failed";
    record.note = err instanceof Error ? err.message : String(err);
    await publish(ctx);
    return false;
  } finally {
    ctx.handle.procKeys.delete(procKey);
  }
}

/**
 * Executes one step list sequentially. On failure the remaining siblings are
 * recorded skipped and false is returned — each nesting level does the same
 * for its own siblings, which implements halt-on-failure end to end.
 */
async function runSteps(
  ctx: EngineCtx,
  steps: WorkflowStep[],
  env: Env,
  depth: number,
  suffix: string,
): Promise<boolean> {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;

    if (ctx.handle.cancelled) {
      pushSkippedTree(ctx, steps.slice(i), depth, "run cancelled", suffix);
      await publish(ctx);
      return false;
    }

    let ok = true;
    switch (step.type) {
      case "form":
        ok = await runFormStep(ctx, step, env, depth, suffix);
        break;

      case "decision": {
        const res = evalExpressionString(step.condition, env);
        if (!res.ok) {
          ctx.run.records.push({
            name: step.name + suffix,
            type: "decision",
            status: "failed",
            depth,
            note: `condition error: ${res.error}`,
          });
          ok = false;
          break;
        }
        const taken = isTruthy(res.value);
        ctx.run.records.push({
          name: step.name + suffix,
          type: "decision",
          status: "succeeded",
          depth,
          note: `${step.condition} → ${taken}`,
        });
        const branchTaken = taken ? step.then : (step.else ?? []);
        const branchSkipped = taken ? (step.else ?? []) : step.then;
        pushSkippedTree(ctx, branchSkipped, depth + 1, `condition was ${taken} — branch not taken`, suffix);
        await publish(ctx);
        ok = await runSteps(ctx, branchTaken, env, depth + 1, suffix);
        break;
      }

      case "loop": {
        const res = evalExpressionString(step.over, env);
        if (!res.ok || !Array.isArray(res.value)) {
          ctx.run.records.push({
            name: step.name + suffix,
            type: "loop",
            status: "failed",
            depth,
            note: res.ok ? `"${step.over}" is not a list` : `loop expression error: ${res.error}`,
          });
          ok = false;
          break;
        }
        const items = res.value;
        ctx.run.records.push({
          name: step.name + suffix,
          type: "loop",
          status: "succeeded",
          depth,
          note: `${items.length} iteration${items.length === 1 ? "" : "s"} over ${step.over}`,
        });
        await publish(ctx);
        for (let idx = 0; idx < items.length; idx++) {
          const childEnv: Env = { ...env, [ITEM_NAME]: items[idx] };
          ok = await runSteps(ctx, step.steps, childEnv, depth + 1, `${suffix}[${idx}]`);
          if (!ok) break;
        }
        break;
      }

      case "parallel": {
        ctx.run.records.push({
          name: step.name + suffix,
          type: "parallel",
          status: "running",
          depth,
          note: `${step.branches.length} branches`,
        });
        const parallelRecord = ctx.run.records[ctx.run.records.length - 1]!;
        await publish(ctx);
        // Each branch resolves against its own env copy; additions merge at
        // the join (branches can't see each other — the scope rule, enforced
        // structurally).
        const branchEnvs = step.branches.map(() => ({ ...env }) as Env);
        const results = await Promise.all(
          step.branches.map((branch, bi) => runSteps(ctx, branch, branchEnvs[bi]!, depth + 1, suffix)),
        );
        for (const branchEnv of branchEnvs) {
          for (const [k, v] of Object.entries(branchEnv)) {
            if (!(k in env)) env[k] = v;
          }
        }
        ok = results.every(Boolean);
        parallelRecord.status = ok ? "succeeded" : "failed";
        break;
      }
    }

    if (!ok) {
      pushSkippedTree(ctx, steps.slice(i + 1), depth, "earlier step failed", suffix);
      await publish(ctx);
      return false;
    }
  }
  return true;
}

/** Starts a Run; returns its id immediately. Execution streams via `onUpdate` and persists throughout. */
export function startWorkflowRun(
  projectPath: string,
  projectName: string,
  workflow: Workflow,
  trigger: WorkflowRunTriggerInfo,
  triggerEnv: Record<string, unknown>,
  onUpdate: (run: WorkflowRun) => void,
): string {
  const run: WorkflowRun = {
    runId: crypto.randomUUID(),
    workflowId: workflow.id,
    workflowName: workflow.name,
    workflow,
    trigger,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    records: [],
  };
  const handle: RunHandle = { cancelled: false, procKeys: new Set() };
  activeRuns.set(run.runId, handle);
  const ctx: EngineCtx = { projectPath, projectName, run, handle, onUpdate, procSeq: 0 };

  void (async () => {
    await publish(ctx);
    const env: Env = { [TRIGGER_NAME]: triggerEnv };
    const ok = await runSteps(ctx, workflow.steps, env, 0, "");
    run.status = handle.cancelled ? "cancelled" : ok ? "succeeded" : "failed";
    run.finishedAt = new Date().toISOString();

    // Generate workflow run summary (ticket 98) — fire-and-forget.
    try {
      const aiSummary = await generateWorkflowSummary(workflow, run);
      run.summary = aiSummary ?? fallbackWorkflowSummary(run);
    } catch (err) {
      console.warn(`[workflowSummary] failed for ${run.runId}:`, err);
      run.summary = fallbackWorkflowSummary(run);
    }

    activeRuns.delete(run.runId);
    await publish(ctx);
  })();

  return run.runId;
}

/** Cancels a live run: kills every live step process (all parallel branches included). */
export function cancelWorkflowRun(runId: string): void {
  const handle = activeRuns.get(runId);
  if (!handle) return;
  handle.cancelled = true;
  for (const key of handle.procKeys) {
    try {
      procRegistry.get(key)?.kill();
    } catch {
      /* already exited */
    }
    procRegistry.unregister(key);
  }
}

// ---------------------------------------------------------------------------
// Dry run (ticket 95): the terraform-plan analogue. Walks exactly as
// execution would, compiles commands via the same buildCommand, resolves
// what's statically known, placeholders the rest. Nothing executes, nothing
// persists.
// ---------------------------------------------------------------------------

/** Per-{{expr}} resolution with ⟨placeholders⟩ for runtime-dependent values. */
function dryResolveTemplate(input: string, env: Env): string {
  return input.replace(/\{\{([^}]*)\}\}/g, (_, exprSrc: string) => {
    const res = evalExpressionString(exprSrc, env);
    if (res.ok && res.value !== undefined) {
      return typeof res.value === "string" ? res.value : JSON.stringify(res.value);
    }
    return `⟨${exprSrc.trim()}⟩`;
  });
}

export async function dryRunWorkflow(
  projectPath: string,
  projectName: string,
  workflow: Workflow,
  params: Record<string, string>,
): Promise<{ plan: WorkflowPlanEntry[]; problems: string[] }> {
  const plan: WorkflowPlanEntry[] = [];
  const problems: string[] = [];
  const env: Env = { [TRIGGER_NAME]: { params } };

  const walk = async (steps: WorkflowStep[], depth: number): Promise<void> => {
    for (const step of steps) {
      switch (step.type) {
        case "form": {
          const folder = await loadTaskFolder(projectPath, step.taskSlug, projectName);
          if (!folder) {
            plan.push({ name: step.name, type: "form", depth, summary: `form not found: ${step.taskSlug}` });
            problems.push(`step "${step.name}": form "${step.taskSlug}" not found`);
            break;
          }
          const inputs: Record<string, unknown> = {};
          for (const [fieldId, template] of Object.entries(step.inputs)) {
            inputs[fieldId] = dryResolveTemplate(template, env);
          }
          let summary: string;
          if (folder.task.command) {
            const built = buildCommand(folder.task, inputs);
            summary = formatCommandPreview(built.tool, built.argv);
          } else {
            summary = `(script form) ${folder.meta.name}`;
          }
          plan.push({ name: step.name, type: "form", depth, summary });
          break;
        }
        case "decision": {
          const res = evalExpressionString(step.condition, env);
          const staticallyKnown = res.ok && res.value !== undefined;
          plan.push({
            name: step.name,
            type: "decision",
            depth,
            summary: `if ${step.condition}`,
            note: staticallyKnown ? `statically ${isTruthy(res.value) ? "true" : "false"}` : "depends on runtime value",
          });
          await walk(step.then, depth + 1);
          if (step.else && step.else.length > 0) {
            plan.push({ name: `${step.name} (else)`, type: "decision", depth, summary: "else" });
            await walk(step.else, depth + 1);
          }
          break;
        }
        case "loop":
          plan.push({
            name: step.name,
            type: "loop",
            depth,
            summary: `for each item of ${step.over}`,
            note: `× per item of ⟨${step.over}⟩`,
          });
          await walk(step.steps, depth + 1);
          break;
        case "parallel":
          plan.push({ name: step.name, type: "parallel", depth, summary: `${step.branches.length} parallel branches` });
          for (let bi = 0; bi < step.branches.length; bi++) {
            plan.push({
              name: `${step.name} · branch ${bi + 1}`,
              type: "parallel",
              depth: depth + 1,
              summary: "branch",
            });
            await walk(step.branches[bi]!, depth + 2);
          }
          break;
      }
    }
  };

  await walk(workflow.steps, 0);
  return { plan, problems };
}

// ---------------------------------------------------------------------------
// Step replay (ticket 95): re-run ONE form step using its captured resolved
// inputs — no re-resolution, no upstream execution, original run untouched.
// ---------------------------------------------------------------------------

export async function replayStep(
  projectPath: string,
  projectName: string,
  run: WorkflowRun,
  recordIndex: number,
): Promise<{ ok: boolean; record?: WorkflowStepRecord; error?: string }> {
  const original = run.records[recordIndex];
  if (!original) return { ok: false, error: "No such step record." };
  if (original.type !== "form") return { ok: false, error: "Only form steps can be replayed." };
  if (!original.resolvedInputs) return { ok: false, error: "This step has no captured inputs to replay." };

  // Locate the step in the run's snapshot (strip loop-iteration suffixes).
  const plainName = original.name.replace(/\[\d+\]/g, "");
  const findForm = (steps: WorkflowStep[]): TaskStep | null => {
    for (const s of steps) {
      if (s.type === "form" && s.name === plainName) return s;
      if (s.type === "decision") {
        const hit = findForm(s.then) ?? findForm(s.else ?? []);
        if (hit) return hit;
      } else if (s.type === "loop") {
        const hit = findForm(s.steps);
        if (hit) return hit;
      } else if (s.type === "parallel") {
        for (const b of s.branches) {
          const hit = findForm(b);
          if (hit) return hit;
        }
      }
    }
    return null;
  };
  const step = findForm(run.workflow.steps);
  if (!step) return { ok: false, error: `Step "${plainName}" not found in the run's snapshot.` };

  const folder = await loadTaskFolder(projectPath, step.taskSlug, projectName);
  if (!folder) return { ok: false, error: `Form "${step.taskSlug}" no longer exists.` };

  try {
    const result = await execFormOnce(folder, original.resolvedInputs, `replay:${run.runId}:${recordIndex}`);
    const record: WorkflowStepRecord = {
      name: `${original.name} (replay)`,
      type: "form",
      status: result.exitCode === 0 ? "succeeded" : "failed",
      depth: 0,
      command: result.commandDisplay,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      resolvedInputs: original.resolvedInputs,
      outputs: result.outputs,
    };
    return { ok: true, record };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
