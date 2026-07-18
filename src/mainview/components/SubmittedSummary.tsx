import { Terminal } from "lucide-react";
import { buildCommand, formatCommandPreview } from "../types/tasks";
import type { TaskDefinition, RunRecord } from "../types/tasks";

interface SubmittedSummaryProps {
  form: TaskDefinition;
  run: RunRecord;
}

function isFilled(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  return value !== undefined && value !== null;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/**
 * The "Submitted" tab (replaces the old disabled-form rendering): a friendly
 * label → value list of what the user submitted, followed by the official
 * command line that ran. Prefers the argv recorded at execution time
 * (`run.command`, ticket 52); falls back to rebuilding it from the form's
 * command spec for runs predating that column. Legacy script forms have no
 * command line to show — the list stands alone.
 */
export default function SubmittedSummary({ form, run }: SubmittedSummaryProps) {
  const rows = form.fields
    .filter((f) => isFilled(run.inputs[f.id]))
    .map((f) => ({ id: f.id, label: f.label || f.id, value: formatValue(run.inputs[f.id]) }));

  const aiPrompt = run.inputs.__aiPrompt;
  if (typeof aiPrompt === "string" && aiPrompt.trim()) {
    rows.push({ id: "__aiPrompt", label: "AI prompt", value: aiPrompt });
  }

  let commandLine: string | null = null;
  if (run.command) {
    commandLine = formatCommandPreview(run.command.tool, run.command.argv);
  } else if (form.command) {
    const built = buildCommand(form, run.inputs);
    commandLine = formatCommandPreview(built.tool, built.argv);
  }

  return (
    <div className="flex flex-col gap-3 px-5 py-3.5">
      {rows.length === 0 ? (
        <div className="text-[13px] text-white/40">No inputs were submitted.</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <div key={row.id} className="flex items-baseline gap-3">
              <span className="w-36 shrink-0 truncate text-[12px] font-medium text-white/50" title={row.label}>
                {row.label}
              </span>
              <span className="min-w-0 break-words text-[13px] text-white/90">{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {commandLine && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/30">Command</span>
          <div className="flex items-start gap-1.5 rounded-md border border-clide-border bg-clide-bg px-2.5 py-2">
            <Terminal size={13} className="mt-0.5 shrink-0 text-white/30" />
            <span className="min-w-0 break-all font-mono text-[12px] text-white/70">{commandLine}</span>
          </div>
        </div>
      )}
    </div>
  );
}
