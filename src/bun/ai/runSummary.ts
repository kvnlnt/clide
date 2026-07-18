import { maskSecrets } from "../../shared/secrets";
import type { AIService, OutputResult, TaskFolder, Workflow, WorkflowRun } from "../../shared/types";
import { getDefaultAIService, legacyProviderForKind, listAIServices } from "./aiServices";
import { complete } from "./providers";

/** Max chars of stdout/stderr included in the summary prompt (ticket 98). */
const MAX_OUTPUT_CHARS = 2000;

/**
 * Resolves which AI service to use for a task — same pattern as magicFill.ts.
 * Task's aiProvider if credentialed, else default service.
 */
async function resolveService(folder: TaskFolder): Promise<AIService | null> {
  const services = await listAIServices();
  if (services.length === 0) return null;
  const preferredKind = folder.meta.aiProvider
    ? services.find((s) => legacyProviderForKind(s.kind) === folder.meta.aiProvider)
    : undefined;
  return preferredKind ?? (await getDefaultAIService()) ?? null;
}

/** Truncate output strings to stay within token budget. */
function truncateOutput(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const half = Math.floor(maxChars / 2);
  return text.slice(0, half) + "\n\n[...truncated...]\n\n" + text.slice(-half);
}

/**
 * Compose the self-reflection prompt for a run (ticket 98).
 * This is the ONE function that assembles the prompt — ticket 100 will
 * prepend a profile block here later.
 */
function buildPrompt(
  folder: TaskFolder,
  inputs: Record<string, unknown>,
  exitCode: number | null,
  stdout: string,
  stderr: string,
  outputs: OutputResult[],
): { system: string; user: string } {
  const maskedInputs = maskSecrets(inputs, folder.task.fields);

  const fieldSummary = folder.task.fields
    .map((f) => {
      const value = maskedInputs[f.id];
      if (value === undefined || value === null) return null;
      if (Array.isArray(value) && value.length === 0) return null;
      if (typeof value === "string" && value.trim() === "") return null;
      const displayValue = Array.isArray(value) ? value.join(", ") : String(value);
      return `${f.label}: ${displayValue}`;
    })
    .filter(Boolean)
    .join("\n");

  const outputSummary = outputs
    .filter((o) => o.ok)
    .map((o) => `${o.name} (${o.kind}): ${String(o.value).slice(0, 100)}`)
    .join("\n");

  const system = [
    "You generate one-line status summaries for CLIDE task runs.",
    "The summary is ~90 chars max, no leading status word (success/error).",
    "The icon already shows success/failure — your line says WHAT and WHY.",
    'Examples: "Backed up ~/Documents → 42 MB zip", "Publish failed: network unreachable"',
  ].join("\n");

  const user = [
    `Task: ${folder.meta.name}`,
    folder.meta.description ? `Description: ${folder.meta.description}` : null,
    fieldSummary ? `Inputs:\n${fieldSummary}` : null,
    `Exit code: ${exitCode ?? "null"}`,
    stdout.trim() ? `Stdout:\n${truncateOutput(stdout, MAX_OUTPUT_CHARS)}` : null,
    stderr.trim() ? `Stderr:\n${truncateOutput(stderr, MAX_OUTPUT_CHARS)}` : null,
    outputSummary ? `Named outputs:\n${outputSummary}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user };
}

/**
 * Generate an AI summary for a completed run (ticket 98).
 * Fire-and-forget — never throws; returns null on any error.
 */
export async function generateRunSummary(
  folder: TaskFolder,
  inputs: Record<string, unknown>,
  exitCode: number | null,
  stdout: string,
  stderr: string,
  outputs: OutputResult[],
): Promise<string | null> {
  try {
    const service = await resolveService(folder);
    if (!service) return null; // No AI configured — skip silently

    const { system, user } = buildPrompt(folder, inputs, exitCode, stdout, stderr, outputs);
    const raw = await complete(service, { system, user });

    // Extract first non-empty line, trim to ~90 chars
    const lines = raw.split("\n").filter((line) => line.trim().length > 0);
    if (lines.length === 0) return null;

    let summary = lines[0].trim();
    // Remove leading status words if present
    summary = summary.replace(/^(success|succeeded|error|failed|done):\s*/i, "");

    // Truncate to ~90 chars at word boundary
    if (summary.length > 95) {
      summary = summary.slice(0, 92).trim();
      const lastSpace = summary.lastIndexOf(" ");
      if (lastSpace > 70) summary = summary.slice(0, lastSpace);
      summary += "…";
    }

    return summary;
  } catch (err) {
    console.warn("[runSummary] AI generation failed:", err);
    return null; // Degrade gracefully
  }
}

/**
 * Fallback heuristic when no AI summary exists (ticket 98 §3).
 */
export function fallbackSummary(
  folder: TaskFolder,
  inputs: Record<string, unknown>,
  exitCode: number | null,
  stderr: string,
): string {
  // Error → first stderr line if available else "Failed"
  if (exitCode !== 0) {
    if (stderr.trim()) {
      const firstLine = stderr.trim().split("\n")[0];
      return firstLine.slice(0, 90);
    }
    return "Failed";
  }

  // Success → "<field label>: <value>" of first filled field
  const firstField = folder.task.fields.find((f) => {
    const v = inputs[f.id];
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "string") return v.trim().length > 0;
    return v !== undefined && v !== null;
  });

  if (firstField) {
    const value = inputs[firstField.id];
    const displayValue = Array.isArray(value) ? value.join(", ") : String(value);
    return `${firstField.label}: ${displayValue}`.slice(0, 90);
  }

  return exitCode === 0 ? "Succeeded" : "Failed";
}

/**
 * Generate an AI summary for a completed workflow run (ticket 98).
 * One summary per workflow run, not per step.
 */
export async function generateWorkflowSummary(workflow: Workflow, run: WorkflowRun): Promise<string | null> {
  try {
    const service = await getDefaultAIService();
    if (!service) return null; // No AI configured — skip silently

    const failedSteps = run.records.filter((r) => r.status === "failed");
    const succeededSteps = run.records.filter((r) => r.status === "succeeded");

    const system = [
      "You generate one-line status summaries for CLIDE workflow runs.",
      "The summary is ~90 chars max, no leading status word (success/error).",
      "The icon already shows success/failure — your line says WHAT and WHY.",
      'Examples: "Processed 3 images, uploaded to S3", "Build failed: missing dependency"',
    ].join("\n");

    const user = [
      `Workflow: ${workflow.name}`,
      workflow.description ? `Description: ${workflow.description}` : null,
      `Trigger: ${run.trigger.type}${run.trigger.detail ? ` (${run.trigger.detail})` : ""}`,
      `Status: ${run.status}`,
      `Steps: ${succeededSteps.length} succeeded${failedSteps.length > 0 ? `, ${failedSteps.length} failed` : ""}`,
      failedSteps.length > 0
        ? `Failed steps:\n${failedSteps
            .map((s) => `- ${s.name}${s.note ? `: ${s.note}` : ""}`)
            .slice(0, 5)
            .join("\n")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const raw = await complete(service, { system, user });

    // Extract first non-empty line, trim to ~90 chars
    const lines = raw.split("\n").filter((line) => line.trim().length > 0);
    if (lines.length === 0) return null;

    let summary = lines[0].trim();
    // Remove leading status words if present
    summary = summary.replace(/^(success|succeeded|error|failed|done):\s*/i, "");

    // Truncate to ~90 chars at word boundary
    if (summary.length > 95) {
      summary = summary.slice(0, 92).trim();
      const lastSpace = summary.lastIndexOf(" ");
      if (lastSpace > 70) summary = summary.slice(0, lastSpace);
      summary += "…";
    }

    return summary;
  } catch (err) {
    console.warn("[workflowSummary] AI generation failed:", err);
    return null; // Degrade gracefully
  }
}

/**
 * Fallback summary for workflow runs when no AI is configured.
 */
export function fallbackWorkflowSummary(run: WorkflowRun): string {
  const failedSteps = run.records.filter((r) => r.status === "failed");

  if (run.status === "failed" || run.status === "cancelled") {
    if (failedSteps.length > 0) {
      const firstFailed = failedSteps[0];
      return `${firstFailed.name} failed${firstFailed.note ? `: ${firstFailed.note}` : ""}`.slice(0, 90);
    }
    return run.status === "cancelled" ? "Cancelled" : "Failed";
  }

  const succeededSteps = run.records.filter((r) => r.status === "succeeded");
  if (succeededSteps.length > 0) {
    return `Completed ${succeededSteps.length} step${succeededSteps.length === 1 ? "" : "s"}`;
  }

  return "Succeeded";
}
