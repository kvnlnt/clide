import { Sparkles, Terminal, Workflow } from "lucide-react";
import { useApp } from "../context/AppContext";
import type { TaskDefinition } from "../types/tasks";
import { buildCommand, formatCommandPreview } from "../types/tasks";
import TaskField from "./TaskField";

interface TaskCardBodyProps {
  taskDef: TaskDefinition;
  values: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
  disabled?: boolean;
  /** Field ids currently being magic-filled (shimmer state). */
  filling?: Set<string>;
  /** The magic fill attempt failed — show a small hint. */
  fillFailed?: boolean;
  /** Slug for the "Starts workflows" lookup (ticket 90); omit to hide it. */
  taskSlug?: string;
}

/** Live "what will run" line for command-backed tasks (ticket 52) — recomputed from current values. */
function CommandPreview({ taskDef, values }: { taskDef: TaskDefinition; values: Record<string, unknown> }) {
  if (!taskDef.command) return null;
  const built = buildCommand(taskDef, values);
  return (
    <div className="flex items-start gap-1.5 rounded-md border border-clide-border bg-clide-bg px-2.5 py-2 font-mono text-[12px] text-white/60">
      <Terminal size={13} className="mt-0.5 shrink-0 text-white/30" />
      <span className="min-w-0 break-all">{formatCommandPreview(built.tool, built.argv)}</span>
    </div>
  );
}

/**
 * "Starts workflows" (ticket 90): every workflow using this task as a
 * trigger, so "what happens if I hit submit?" is always answered on the
 * task itself. Renders nothing when no workflow is attached.
 */
function StartsWorkflows({ taskSlug }: { taskSlug?: string }) {
  const { workflows } = useApp();
  if (!taskSlug) return null;
  const starting = workflows.filter(
    (w) => w.enabled && w.triggers.some((t) => t.type === "task-submitted" && t.taskSlug === taskSlug),
  );
  if (starting.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-white/40">
      <Workflow size={12} className="shrink-0 text-orange-300/70" />
      <span>
        Starts workflow{starting.length === 1 ? "" : "s"}:{" "}
        <span className="text-white/60">{starting.map((w) => w.name).join(", ")}</span> when it finishes
      </span>
    </div>
  );
}

export default function TaskCardBody({
  taskDef,
  values,
  onChange,
  disabled,
  filling,
  fillFailed,
  taskSlug,
}: TaskCardBodyProps) {
  if (taskDef.fields.length === 0) {
    return (
      <div className="flex flex-col gap-3 px-5 py-3.5">
        <div className="text-[13px] text-white/40">No inputs — press SEND to run.</div>
        <CommandPreview taskDef={taskDef} values={values} />
        <StartsWorkflows taskSlug={taskSlug} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 px-5 py-3.5">
      {fillFailed && (
        <div className="flex items-center gap-1.5 text-[11px] text-white/30">
          <Sparkles size={11} /> couldn't auto-fill — fill the fields manually
        </div>
      )}
      {taskDef.fields.map((field) => {
        const isFilling = filling?.has(field.id) === true;
        return (
          <div key={field.id} className={`flex flex-col gap-1.5 ${isFilling ? "animate-pulse" : ""}`}>
            <label className="flex items-center gap-1.5 text-[14px] font-bold text-white/70">
              {field.label}
              {field.required && <span className="text-red-400"> *</span>}
              {field.magic && (
                <span
                  className={`flex items-center ${isFilling ? "text-amber-300" : "text-amber-300/50"}`}
                  title={`Magic fill: ${field.magic.prompt}`}
                >
                  <Sparkles size={12} />
                </span>
              )}
            </label>
            {field.description && <span className="text-[12px] text-white/40">{field.description}</span>}
            <TaskField
              field={field}
              value={values[field.id]}
              onChange={(v) => onChange(field.id, v)}
              disabled={disabled || isFilling}
            />
          </div>
        );
      })}
      <CommandPreview taskDef={taskDef} values={values} />
      <StartsWorkflows taskSlug={taskSlug} />
    </div>
  );
}
