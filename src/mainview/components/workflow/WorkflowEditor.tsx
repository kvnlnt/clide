import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  GitBranch,
  Lock,
  Play,
  Plus,
  Repeat,
  Split,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { STEP_NAME_RE, allSteps, computeScopes, expressionRefs, templateRefs } from "../../../shared/workflowExpr";
import { useApp } from "../../context/AppContext";
import { api } from "../../rpc";
import type { DecisionStep, TaskFolder, TaskStep, Workflow, WorkflowStep, WorkflowTrigger } from "../../types/tasks";
import { buildCommand, formatCommandPreview } from "../../types/tasks";
import { useEscapeToClose } from "../Modal";
import { useUIFeedback } from "../UIFeedback";

const inputBase =
  "w-full rounded border border-clide-border bg-clide-surface text-white text-[13px] px-2.5 py-1.5 outline-none placeholder:text-white/30 focus:border-white/30";
const fieldLabel = "text-[12px] font-medium text-white/60";
const fieldHint = "text-[11px] text-white/30";

const STEP_ICON = { form: Play, decision: GitBranch, loop: Repeat, parallel: Split } as const;

// ---------------------------------------------------------------------------
// Validation (ticket 91): unknown/out-of-scope references, duplicate names,
// missing tasks, expression syntax, missing required fields. Non-blocking
// flags per step + a summary that gates Save.
// ---------------------------------------------------------------------------

function validate(workflow: Workflow, tasksBySlug: Map<string, TaskFolder>): Map<string, string[]> {
  const problems = new Map<string, string[]>();
  const add = (name: string, msg: string) => problems.set(name, [...(problems.get(name) ?? []), msg]);

  const steps = allSteps(workflow.steps);
  const seen = new Set<string>();
  for (const s of steps) {
    if (!STEP_NAME_RE.test(s.name)) add(s.name, "name must be slug-safe (a-z, 0-9, -, _)");
    if (seen.has(s.name)) add(s.name, "duplicate step name");
    seen.add(s.name);
  }

  const scopes = computeScopes(workflow);
  const checkRefs = (stepName: string, roots: string[], label: string) => {
    const scope = new Set(scopes.get(stepName) ?? []);
    for (const root of roots) {
      if (!scope.has(root)) {
        const exists = steps.some((s) => s.name === root);
        add(stepName, exists ? `${label}: "${root}" is out of scope here` : `${label}: unknown reference "${root}"`);
      }
    }
  };

  for (const s of steps) {
    if (s.type === "form") {
      const folder = tasksBySlug.get(s.taskSlug);
      if (!folder) add(s.name, `task "${s.taskSlug}" not found`);
      else {
        for (const f of folder.task.fields) {
          if (f.required && !(f.id in s.inputs)) add(s.name, `required field "${f.label || f.id}" is unset`);
        }
      }
      for (const [fieldId, value] of Object.entries(s.inputs)) {
        const { roots, errors } = templateRefs(value);
        for (const e of errors) add(s.name, `field "${fieldId}": ${e}`);
        checkRefs(s.name, roots, `field "${fieldId}"`);
      }
    } else if (s.type === "decision") {
      const { roots, error } = expressionRefs(s.condition);
      if (error) add(s.name, `condition: ${error}`);
      checkRefs(s.name, roots, "condition");
    } else if (s.type === "loop") {
      const { roots, error } = expressionRefs(s.over);
      if (error) add(s.name, `loop expression: ${error}`);
      checkRefs(s.name, roots, "loop expression");
    }
  }
  return problems;
}

/** Reference suggestions for a step's scope: named outputs + stdout of in-scope task steps, trigger, item. */
function buildSuggestions(workflow: Workflow, stepName: string, tasksBySlug: Map<string, TaskFolder>): string[] {
  const scopes = computeScopes(workflow);
  const scope = scopes.get(stepName) ?? [];
  const stepBySlugName = new Map(allSteps(workflow.steps).map((s) => [s.name, s]));
  const out: string[] = [];
  for (const root of scope) {
    if (root === "trigger") {
      for (const p of workflow.params ?? []) out.push(`trigger.params.${p}`);
      out.push("trigger.stdout");
      continue;
    }
    if (root === "item") {
      out.push("item");
      continue;
    }
    const step = stepBySlugName.get(root);
    if (step?.type === "form") {
      const folder = tasksBySlug.get(step.taskSlug);
      for (const def of folder?.task.outputs ?? []) out.push(`${root}.outputs.${def.name}`);
      out.push(`${root}.stdout`, `${root}.exitCode`);
    }
  }
  return out;
}

let nameSeq = 0;
function freshName(workflow: Workflow, base: string): string {
  const taken = new Set(allSteps(workflow.steps).map((s) => s.name));
  let candidate = base;
  while (taken.has(candidate)) candidate = `${base}_${++nameSeq}`;
  return candidate;
}

// ---------------------------------------------------------------------------
// Reference-aware input (ticket 91): literal text; the ⟨+ ref⟩ picker inserts
// {{…}} from the in-scope suggestions — the "wire from previous step" path.
// ---------------------------------------------------------------------------

function ReferenceInput({
  value,
  onChange,
  suggestions,
  placeholder,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        className={`${inputBase} ${mono ? "font-mono" : ""} min-w-0 flex-1`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {suggestions.length > 0 && (
        <select
          className={`${inputBase} w-8 shrink-0 appearance-none px-1 text-center text-white/40`}
          value=""
          title="Insert a reference to an earlier step"
          onChange={(e) => {
            if (e.target.value) onChange(value + `{{${e.target.value}}}`);
          }}
        >
          <option value="" className="bg-clide-panel">
            +
          </option>
          {suggestions.map((s) => (
            <option key={s} value={s} className="bg-clide-panel">
              {`{{${s}}}`}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step cards & recursive lists.
// ---------------------------------------------------------------------------

interface StepCtx {
  workflow: Workflow;
  tasksBySlug: Map<string, TaskFolder>;
  projectTasks: TaskFolder[];
  problems: Map<string, string[]>;
}

function stepSummary(step: WorkflowStep, tasksBySlug: Map<string, TaskFolder>): string {
  switch (step.type) {
    case "form":
      return tasksBySlug.get(step.taskSlug)?.meta.name ?? step.taskSlug;
    case "decision":
      return `if ${step.condition || "…"}`;
    case "loop":
      return `for each item of ${step.over || "…"}`;
    case "parallel":
      return `${step.branches.length} parallel branches`;
  }
}

/** {{expr}} → ⟨expr⟩ for the compiled-command preview. */
function placeholderResolve(value: string): string {
  return value.replace(/\{\{([^}]*)\}\}/g, (_, e: string) => `⟨${e.trim()}⟩`);
}

function TaskStepBody({ step, onChange, ctx }: { step: TaskStep; onChange: (s: TaskStep) => void; ctx: StepCtx }) {
  const folder = ctx.tasksBySlug.get(step.taskSlug);
  const suggestions = useMemo(
    () => buildSuggestions(ctx.workflow, step.name, ctx.tasksBySlug),
    [ctx.workflow, step.name, ctx.tasksBySlug],
  );

  const compiled = useMemo(() => {
    if (!folder?.task.command) return null;
    const inputs: Record<string, unknown> = {};
    for (const [fieldId, value] of Object.entries(step.inputs)) inputs[fieldId] = placeholderResolve(value);
    const built = buildCommand(folder.task, inputs);
    return formatCommandPreview(built.tool, built.argv);
  }, [folder, step.inputs]);

  const pinnedVersion = step.taskVersion;
  const latestVersion = folder?.meta.version;
  const hasUpdate = pinnedVersion && latestVersion && pinnedVersion < latestVersion;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className={fieldLabel}>Task</label>
        <div className="flex items-center gap-2">
          <select
            className={`${inputBase} flex-1 appearance-none`}
            value={step.taskSlug}
            onChange={(e) => onChange({ ...step, taskSlug: e.target.value, inputs: {} })}
          >
            {!ctx.tasksBySlug.has(step.taskSlug) && (
              <option value={step.taskSlug} className="bg-clide-panel">
                (missing) {step.taskSlug}
              </option>
            )}
            {ctx.projectTasks.map((f) => (
              <option key={f.meta.slug} value={f.meta.slug} className="bg-clide-panel">
                {f.meta.name}
              </option>
            ))}
          </select>
          {folder && (
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="text-[11px] text-white/40">
                v{pinnedVersion ?? latestVersion}
                {!pinnedVersion && " (latest)"}
              </span>
              {folder.meta.lifecycle === "draft" ? (
                <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[9px] font-medium text-yellow-400">
                  draft
                </span>
              ) : (
                <Lock size={10} className="text-white/30" />
              )}
              {hasUpdate && (
                <span className="text-[11px] text-blue-400" title={`v${latestVersion} available`}>
                  ↑ v{latestVersion}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {folder &&
        folder.task.fields.map((field) => (
          <div key={field.id} className="flex flex-col gap-1">
            <label className={fieldLabel}>
              {field.label || field.id}
              {field.required && <span className="text-red-400"> *</span>}
            </label>
            <ReferenceInput
              value={step.inputs[field.id] ?? ""}
              onChange={(v) => {
                const inputs = { ...step.inputs };
                if (v === "") delete inputs[field.id];
                else inputs[field.id] = v;
                onChange({ ...step, inputs });
              }}
              suggestions={suggestions}
              placeholder={field.placeholder ?? "Literal value or {{reference}}"}
            />
            {field.description && <span className={fieldHint}>{field.description}</span>}
          </div>
        ))}

      {compiled && (
        <div className="flex items-start gap-1.5 rounded-md border border-clide-border bg-clide-bg px-2.5 py-2">
          <Terminal size={13} className="mt-0.5 shrink-0 text-white/30" />
          <span className="min-w-0 break-all font-mono text-[12px] text-white/60">{compiled}</span>
        </div>
      )}
    </div>
  );
}

function StepCard({
  step,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  ctx,
  depth,
}: {
  step: WorkflowStep;
  onChange: (s: WorkflowStep) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  ctx: StepCtx;
  depth: number;
}) {
  const [open, setOpen] = useState(step.type === "form" && step.taskSlug === "");
  const Icon = STEP_ICON[step.type];
  const issues = ctx.problems.get(step.name) ?? [];
  const suggestions = useMemo(
    () => buildSuggestions(ctx.workflow, step.name, ctx.tasksBySlug),
    [ctx.workflow, step.name, ctx.tasksBySlug],
  );

  const iconBtn =
    "flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/30 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent";

  return (
    <div
      className={`rounded-lg border bg-white/[0.02] ${issues.length > 0 ? "border-amber-400/30" : "border-white/5"}`}
    >
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {open ? (
            <ChevronDown size={13} className="shrink-0 text-white/30" />
          ) : (
            <ChevronRight size={13} className="shrink-0 text-white/30" />
          )}
          <Icon size={13} className="shrink-0 text-white/40" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-[13px] font-medium text-white">{step.name}</span>
              <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-white/40">
                {step.type}
              </span>
              {issues.length > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-amber-300/80" title={issues.join("\n")}>
                  <AlertTriangle size={11} /> {issues.length}
                </span>
              )}
            </div>
            <span className="block truncate text-[12px] text-white/40">{stepSummary(step, ctx.tasksBySlug)}</span>
          </div>
        </button>
        <button onClick={onMoveUp} disabled={!onMoveUp} className={iconBtn} title="Move up">
          <ArrowUp size={13} />
        </button>
        <button onClick={onMoveDown} disabled={!onMoveDown} className={iconBtn} title="Move down">
          <ArrowDown size={13} />
        </button>
        <button onClick={onRemove} className={`${iconBtn} hover:text-red-400`} title="Delete step">
          <Trash2 size={13} />
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-3 border-t border-white/5 px-3.5 py-3">
          <div className="flex flex-col gap-1">
            <label className={fieldLabel}>Step name</label>
            <input
              className={`${inputBase} w-64 font-mono`}
              value={step.name}
              onChange={(e) => onChange({ ...step, name: e.target.value })}
            />
            <span className={fieldHint}>Unique and slug-safe — later steps reference outputs by this name</span>
          </div>

          {issues.length > 0 && (
            <div className="flex flex-col gap-0.5 rounded-md border border-amber-400/30 bg-amber-400/5 px-2.5 py-2">
              {issues.map((msg, i) => (
                <span key={i} className="text-[12px] text-amber-200">
                  {msg}
                </span>
              ))}
            </div>
          )}

          {step.type === "form" && <TaskStepBody step={step} onChange={onChange} ctx={ctx} />}

          {step.type === "decision" && (
            <>
              <div className="flex flex-col gap-1">
                <label className={fieldLabel}>Condition</label>
                <ReferenceInput
                  mono
                  value={step.condition}
                  onChange={(v) => onChange({ ...step, condition: v.replace(/\{\{|\}\}/g, "") })}
                  suggestions={suggestions}
                  placeholder="e.g. fetch_rss.outputs.items.length > 0"
                />
                <span className={fieldHint}>Truthy runs "then"; otherwise "else"</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={fieldLabel}>Then</label>
                <StepList
                  steps={step.then}
                  onChange={(then) => onChange({ ...step, then })}
                  ctx={ctx}
                  depth={depth + 1}
                />
              </div>
              {step.else ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className={fieldLabel}>Else</label>
                    <button
                      onClick={() => onChange({ ...step, else: undefined } as DecisionStep)}
                      className="text-[11px] text-white/30 hover:text-white/60"
                    >
                      remove else
                    </button>
                  </div>
                  <StepList
                    steps={step.else}
                    onChange={(elseSteps) => onChange({ ...step, else: elseSteps })}
                    ctx={ctx}
                    depth={depth + 1}
                  />
                </div>
              ) : (
                <button
                  onClick={() => onChange({ ...step, else: [] })}
                  className="flex items-center gap-1 self-start text-[12px] text-white/40 hover:text-white/70"
                >
                  <Plus size={12} /> add else branch
                </button>
              )}
            </>
          )}

          {step.type === "loop" && (
            <>
              <div className="flex flex-col gap-1">
                <label className={fieldLabel}>For each item of</label>
                <ReferenceInput
                  mono
                  value={step.over}
                  onChange={(v) => onChange({ ...step, over: v.replace(/\{\{|\}\}/g, "") })}
                  suggestions={suggestions}
                  placeholder="e.g. fetch_rss.outputs.items"
                />
                <span className={fieldHint}>
                  Runs the steps below once per element; the current element is <span className="font-mono">item</span>
                </span>
              </div>
              <StepList
                steps={step.steps}
                onChange={(steps) => onChange({ ...step, steps })}
                ctx={ctx}
                depth={depth + 1}
              />
            </>
          )}

          {step.type === "parallel" && (
            <>
              {step.branches.map((branch, bi) => (
                <div key={bi} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className={fieldLabel}>Branch {bi + 1}</label>
                    {step.branches.length > 2 && (
                      <button
                        onClick={() => onChange({ ...step, branches: step.branches.filter((_, i) => i !== bi) })}
                        className="text-[11px] text-white/30 hover:text-white/60"
                      >
                        remove branch
                      </button>
                    )}
                  </div>
                  <StepList
                    steps={branch}
                    onChange={(next) =>
                      onChange({ ...step, branches: step.branches.map((b, i) => (i === bi ? next : b)) })
                    }
                    ctx={ctx}
                    depth={depth + 1}
                  />
                </div>
              ))}
              <button
                onClick={() => onChange({ ...step, branches: [...step.branches, []] })}
                className="flex items-center gap-1 self-start text-[12px] text-white/40 hover:text-white/70"
              >
                <Plus size={12} /> add branch
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StepList({
  steps,
  onChange,
  ctx,
  depth,
}: {
  steps: WorkflowStep[];
  onChange: (steps: WorkflowStep[]) => void;
  ctx: StepCtx;
  depth: number;
}) {
  const move = (i: number, dir: -1 | 1) => {
    const t = i + dir;
    if (t < 0 || t >= steps.length) return;
    const next = [...steps];
    [next[i], next[t]] = [next[t]!, next[i]!];
    onChange(next);
  };

  const add = (type: WorkflowStep["type"]) => {
    const name = freshName(ctx.workflow, type === "form" ? "step" : type);
    const step: WorkflowStep =
      type === "form"
        ? { type, name, taskSlug: ctx.projectTasks[0]?.meta.slug ?? "", inputs: {} }
        : type === "decision"
          ? { type, name, condition: "", then: [] }
          : type === "loop"
            ? { type, name, over: "", steps: [] }
            : { type, name, branches: [[], []] };
    onChange([...steps, step]);
  };

  return (
    <div className={`flex flex-col gap-1.5 ${depth > 0 ? "border-l border-white/10 pl-3" : ""}`}>
      {steps.length === 0 && <span className="text-[12px] italic text-white/25">No steps yet.</span>}
      {steps.map((step, i) => (
        <StepCard
          key={`${i}-${step.name}`}
          step={step}
          onChange={(s) => onChange(steps.map((x, xi) => (xi === i ? s : x)))}
          onRemove={() => onChange(steps.filter((_, xi) => xi !== i))}
          onMoveUp={i > 0 ? () => move(i, -1) : undefined}
          onMoveDown={i < steps.length - 1 ? () => move(i, 1) : undefined}
          ctx={ctx}
          depth={depth}
        />
      ))}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-white/25">Add step:</span>
        {(["form", "decision", "loop", "parallel"] as const).map((t) => {
          const Icon = STEP_ICON[t];
          return (
            <button
              key={t}
              onClick={() => add(t)}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] text-white/40 hover:bg-white/5 hover:text-white"
            >
              <Icon size={11} /> {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trigger editor (ticket 90 UI).
// ---------------------------------------------------------------------------

function TriggersEditor({
  workflow,
  onChange,
  projectTasks,
}: {
  workflow: Workflow;
  onChange: (w: Workflow) => void;
  projectTasks: TaskFolder[];
}) {
  const triggers = workflow.triggers;
  const set = (next: WorkflowTrigger[]) => onChange({ ...workflow, triggers: next });

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wider text-white/30">Triggers</label>
      <span className={fieldHint}>
        Workflows start only from these — submitting a task on its own never propagates. Schedules fire only while CLIDE
        is running.
      </span>
      {triggers.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            className={`${inputBase} w-44 shrink-0 appearance-none`}
            value={t.type}
            onChange={(e) => {
              const type = e.target.value as WorkflowTrigger["type"];
              const next: WorkflowTrigger =
                type === "manual"
                  ? { type }
                  : type === "schedule"
                    ? { type, cron: "0 9 * * *" }
                    : { type, taskSlug: projectTasks[0]?.meta.slug ?? "" };
              set(triggers.map((x, xi) => (xi === i ? next : x)));
            }}
          >
            <option value="manual" className="bg-clide-panel">
              Manual (Run button)
            </option>
            <option value="schedule" className="bg-clide-panel">
              Schedule (cron)
            </option>
            <option value="task-submitted" className="bg-clide-panel">
              When a task finishes
            </option>
          </select>
          {t.type === "schedule" && (
            <input
              className={`${inputBase} w-40 font-mono`}
              placeholder="m h dom mon dow"
              value={t.cron}
              onChange={(e) => set(triggers.map((x, xi) => (xi === i ? { ...t, cron: e.target.value } : x)))}
            />
          )}
          {t.type === "task-submitted" && (
            <select
              className={`${inputBase} w-56 appearance-none`}
              value={t.taskSlug}
              onChange={(e) => set(triggers.map((x, xi) => (xi === i ? { ...t, taskSlug: e.target.value } : x)))}
            >
              {projectTasks.map((f) => (
                <option key={f.meta.slug} value={f.meta.slug} className="bg-clide-panel">
                  {f.meta.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => set(triggers.filter((_, xi) => xi !== i))}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/30 hover:bg-white/10 hover:text-red-400"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button
        onClick={() => set([...triggers, { type: "manual" }])}
        className="flex items-center gap-1 self-start text-[12px] text-white/40 hover:text-white/70"
      >
        <Plus size={12} /> add trigger
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The editor itself: full-window overlay, controlled Workflow value.
// ---------------------------------------------------------------------------

interface WorkflowEditorProps {
  initial: Workflow;
  onClose: () => void;
  /** Notes from the AI draft (ticket 92), shown as a hint bar. */
  draftNotes?: string[];
  /** When true, focus and select the name field on open. */
  focusName?: boolean;
}

export default function WorkflowEditor({ initial, onClose, draftNotes, focusName }: WorkflowEditorProps) {
  const { tasks, activeProject, tasksBySlug, saveWorkflow, openWorkflowEditor, refreshWorkflows } = useApp();
  const { confirm, toast } = useUIFeedback();
  const [wf, setWf] = useState<Workflow>(initial);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const projectTasks = tasks.filter((t) => t.meta.project === activeProject);
  const problems = useMemo(() => validate(wf, tasksBySlug), [wf, tasksBySlug]);
  const totalIssues = Array.from(problems.values()).reduce((n, list) => n + list.length, 0);
  const dirty = JSON.stringify(wf) !== JSON.stringify(initial);

  const requestClose = async () => {
    if (dirty) {
      const res = await confirm({
        title: "Discard workflow changes?",
        message: "Unsaved edits to this workflow will be lost.",
        confirmLabel: "Discard",
      });
      if (!res.ok) return;
    }
    onClose();
  };
  useEscapeToClose(() => void requestClose());

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const res = await saveWorkflow(wf);
    setSaving(false);
    if (res.ok) {
      toast("Workflow saved");
      onClose();
    } else {
      setSaveError(res.error ?? "Save failed");
    }
  };

  const ctx: StepCtx = { workflow: wf, tasksBySlug, projectTasks, problems };

  // Focus name input when requested (for duplicate flow). Select text so first
  // keystroke replaces it.
  const nameRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (focusName) {
      // Defer to next tick so the element is mounted and visible in the overlay.
      setTimeout(() => {
        try {
          nameRef.current?.focus();
          nameRef.current?.select();
        } catch {
          /* best-effort */
        }
      }, 30);
    }
  }, [focusName]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-4 px-8 pb-4 pt-7">
        <h1 className="shrink-0 text-[20px] font-bold text-white">{wf.name.trim() || "New workflow"}</h1>
        <label className="flex items-center gap-1.5 text-[12px] text-white/50">
          <input type="checkbox" checked={wf.enabled} onChange={(e) => setWf({ ...wf, enabled: e.target.checked })} />
          Enabled
        </label>
        <div className="flex-1" />
        {totalIssues > 0 && (
          <span className="flex items-center gap-1 text-[12px] text-amber-300/80">
            <AlertTriangle size={12} /> {totalIssues} issue{totalIssues === 1 ? "" : "s"}
          </span>
        )}
        <button
          onClick={async () => {
            if (!activeProject) return;
            const res = await api.duplicateWorkflow(activeProject, wf.id);
            if (!res.ok || !res.workflow) {
              toast(res.error ?? "Couldn't duplicate workflow", "error");
              return;
            }
            toast(`Duplicated '${wf.name}'`);
            // Open the duplicated workflow in the editor and focus its name
            openWorkflowEditor(res.workflow, true);
            await refreshWorkflows();
          }}
          title="Duplicate"
          className="flex h-8 w-8 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
        >
          <Copy size={16} />
        </button>
        <button
          onClick={() => void requestClose()}
          title="Close"
          className="flex h-8 w-8 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="clide-scroll min-h-0 flex-1 overflow-y-auto px-8 pb-4">
        <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5">
          {draftNotes && draftNotes.length > 0 && (
            <div className="flex flex-col gap-0.5 rounded-md border border-amber-400/30 bg-amber-400/5 px-3 py-2">
              {draftNotes.map((n, i) => (
                <span key={i} className="text-[12px] text-amber-200">
                  {n}
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className={fieldLabel}>Name</label>
              <input
                ref={nameRef}
                className={inputBase}
                value={wf.name}
                onChange={(e) => setWf({ ...wf, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={fieldLabel}>Manual-run parameters</label>
              <input
                className={inputBase}
                placeholder="Comma-separated names, e.g. channel, tag"
                value={(wf.params ?? []).join(", ")}
                onChange={(e) =>
                  setWf({
                    ...wf,
                    params: e.target.value
                      .split(",")
                      .map((p) => p.trim())
                      .filter(Boolean),
                  })
                }
              />
              <span className={fieldHint}>Prompted for on manual runs; addressable as trigger.params.&lt;name&gt;</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className={fieldLabel}>Description</label>
            <textarea
              className={`${inputBase} min-h-[48px] resize-y`}
              value={wf.description}
              onChange={(e) => setWf({ ...wf, description: e.target.value })}
            />
          </div>

          <TriggersEditor workflow={wf} onChange={setWf} projectTasks={projectTasks} />

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-white/30">Steps</label>
            <StepList steps={wf.steps} onChange={(steps) => setWf({ ...wf, steps })} ctx={ctx} depth={0} />
          </div>

          {saveError && (
            <div className="rounded border border-red-500/40 bg-red-500/5 p-3 text-[13px] text-red-300">
              {saveError}
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto flex shrink-0 items-center justify-end gap-2 border-t border-clide-border px-8 py-4">
        <button
          onClick={() => void requestClose()}
          className="rounded-md px-3 py-1.5 text-[13px] text-white/50 hover:bg-white/5 hover:text-white"
        >
          Cancel
        </button>
        <button
          disabled={saving || totalIssues > 0 || wf.name.trim() === ""}
          onClick={() => void save()}
          title={totalIssues > 0 ? "Fix the flagged issues first" : undefined}
          className="rounded-md bg-white/10 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save workflow"}
        </button>
      </div>
    </div>
  );
}
