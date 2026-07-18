import { ArrowLeft, Loader, RefreshCw, Sparkles, Terminal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../rpc";
import CommandFieldsEditor from "./CommandFieldsEditor";
import FormPreview from "./FormPreview";
import { useEscapeToClose } from "./Modal";
import OutputDefinitionsEditor from "./OutputDefinitionsEditor";
import ServiceModelPicker, { type ServiceModelValue } from "./ServiceModelPicker";
import ToolChooser from "./ToolChooser";
import WizardSteps from "./WizardSteps";
import { buildCommand, formatCommandPreview } from "../types/forms";
import type { FormField, OutputDefinition, OutputType, ToolRegistryEntry } from "../types/forms";

interface NewFormPageProps {
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ["Describe", "Tool", "Fields", "Outputs"] as const;

function isSampleFilled(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
}

/**
 * Inputs feeding the featured command preview: the user's sample values from
 * the live preview pane (ticket 66) where present, `<Label>` placeholders
 * otherwise — so the argv shape is always visible and real samples
 * materialize in place.
 */
function previewInputs(fields: FormField[], samples: Record<string, unknown>): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  for (const f of fields) {
    if (!f.argMapping) continue;
    const sample = samples[f.id];
    if (f.argMapping.kind === "flag") {
      inputs[f.id] = typeof sample === "boolean" ? sample : true;
      continue;
    }
    if (isSampleFilled(sample)) {
      inputs[f.id] = sample;
      continue;
    }
    const placeholder = `<${f.label || f.id}>`;
    inputs[f.id] = f.argMapping.repeat ? [placeholder] : placeholder;
  }
  return inputs;
}

/**
 * Command-backed form creation wizard (tickets 54, 59-63): state the goal →
 * specify or OK the tool → tune the pre-drafted fields → outputs & events.
 * The header step indicator jumps to any reachable step; AI accelerates
 * every step but never gates one.
 */
export default function NewFormPage({ onClose }: NewFormPageProps) {
  const { addFormDraft, projects, activeProject } = useApp();

  const [step, setStep] = useState<Step>(1);
  const [serviceModel, setServiceModel] = useState<ServiceModelValue>({ serviceId: "", model: "" });

  // Step 1 — the goal doubles as the form's description.
  const [goal, setGoal] = useState("");
  const [name, setName] = useState("");
  const [project, setProject] = useState(activeProject || projects[0] || "");

  // Step 2
  const [tool, setTool] = useState<ToolRegistryEntry | null>(null);
  const [actionName, setActionName] = useState("");
  const [baseArgsText, setBaseArgsText] = useState("");

  // Step 3
  const [fields, setFields] = useState<FormField[]>([]);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  /** Which tool+action the current fields were drafted for — drives the "drafted for another tool" hint. */
  const [draftedFor, setDraftedFor] = useState<{ toolId: string; toolName: string } | null>(null);
  /** Tool+action keys already auto-drafted (or attempted) — a revisit never re-drafts over edits. */
  const autoDraftTried = useRef<Set<string>>(new Set());
  /** Open editor card, lifted so the preview pane can highlight/open it (tickets 64/66). */
  const [openFieldId, setOpenFieldId] = useState<string | null>(null);
  /** Scratch values typed into the preview pane — feed the command preview, never persisted (ticket 66). */
  const [sampleValues, setSampleValues] = useState<Record<string, unknown>>({});
  /** field id → type at last render, to reset samples whose field type changed. */
  const sampleTypes = useRef<Map<string, string>>(new Map());

  // A type change makes the old sample nonsensical (string in a number box) — drop it.
  useEffect(() => {
    const stale: string[] = [];
    for (const f of fields) {
      const prev = sampleTypes.current.get(f.id);
      if (prev !== undefined && prev !== f.type) stale.push(f.id);
    }
    sampleTypes.current = new Map(fields.map((f) => [f.id, f.type]));
    if (stale.length > 0) {
      setSampleValues((prev) => {
        const next = { ...prev };
        for (const id of stale) delete next[id];
        return next;
      });
    }
  }, [fields]);

  // Step 4 (ticket 78): raw output is always captured; definitions extract named pieces.
  const [outputs, setOutputs] = useState<OutputDefinition[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const baseArgs = baseArgsText.trim() ? baseArgsText.trim().split(/\s+/) : [];

  const selectTool = (t: ToolRegistryEntry | null) => {
    setTool(t);
    if (t) {
      setName((n) => n || t.name);
      // A different tool resets the scoped action; same tool re-picked keeps it.
      if (tool && tool.id !== t.id) {
        setActionName("");
        setBaseArgsText("");
      }
    }
  };

  const runDraft = async () => {
    if (!tool?.spec || !serviceModel.serviceId) return;
    setDraftBusy(true);
    setDraftError(null);
    const res = await api.draftCommandFields(
      goal,
      tool.name,
      actionName || tool.name,
      tool.spec,
      serviceModel.serviceId,
      serviceModel.model,
    );
    setDraftBusy(false);
    if (!res.ok || !res.fields) {
      setDraftError(res.error ?? "Couldn't draft fields.");
      return;
    }
    setFields(res.fields);
    setDraftedFor({ toolId: tool.id, toolName: tool.name });
    // Fresh field ids — old samples and open-card state no longer apply.
    setSampleValues({});
    setOpenFieldId(null);
  };

  // Auto-draft on first entry to step 3 (ticket 61): only when the field list
  // is empty and this tool+action hasn't been tried — edits are never clobbered.
  useEffect(() => {
    if (step !== 3 || !tool?.spec || !serviceModel.serviceId || fields.length > 0 || draftBusy) return;
    const key = `${tool.id}:${actionName}`;
    if (autoDraftTried.current.has(key)) return;
    autoDraftTried.current.add(key);
    void runDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, tool, actionName, serviceModel.serviceId, fields.length, draftBusy]);

  const create = async () => {
    if (!tool || !name.trim() || !project.trim()) return;
    setCreating(true);
    setCreateError(null);
    const outputType: OutputType = outputs[0]?.kind ?? "text";
    const res = await api.createCommandForm({
      project: project.trim(),
      name: name.trim(),
      description: goal.trim(),
      tags: [],
      command: { tool: tool.execPath, baseArgs },
      fields,
      outputType,
      outputs,
    });
    setCreating(false);
    if (res.ok && res.slug) {
      addFormDraft(res.slug);
      onClose();
      return;
    }
    setCreateError(res.error ?? "Failed to create form");
  };

  // Reachability mirrors the footer gating (ticket 63).
  const reachable: Record<Step, boolean> = {
    1: true,
    2: goal.trim().length > 0,
    3: tool !== null,
    4: tool !== null,
  };
  const stepDefs = STEP_LABELS.map((label, i) => ({
    label,
    reachable: reachable[(i + 1) as Step],
    hint: i === 1 ? "Describe the goal first" : "Pick a tool first",
  }));

  // Empty-label fields would render broken on the real card — block CREATE, don't silently drop (ticket 64).
  const unlabeledField = fields.some((f) => f.label.trim() === "");
  const canCreate = name.trim().length > 0 && project.trim().length > 0 && !unlabeledField && !creating;
  const staleFieldsHint = fields.length > 0 && draftedFor && tool && draftedFor.toolId !== tool.id;

  const inputBase =
    "w-full rounded border border-clide-border bg-clide-surface text-white text-[13px] px-2.5 py-1.5 outline-none placeholder:text-white/30 focus:border-white/30";

  const commandPreview = tool
    ? formatCommandPreview(
        tool.execPath,
        buildCommand(
          { fields, outputType: "text", command: { tool: tool.execPath, baseArgs } },
          previewInputs(fields, sampleValues),
        ).argv,
      )
    : "";

  // Escape always closes (window-level, focus-independent — ticket 75).
  useEscapeToClose(onClose);

  return (
    // min-h-0: same overlay flex chain as SettingsPanel (ticket 68) — without
    // it the wizard body grows past the window instead of scrolling.
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-4 px-8 pb-4 pt-7">
        <h1 className="shrink-0 text-[20px] font-bold text-white">{name.trim() || "Create new form"}</h1>
        <WizardSteps steps={stepDefs} current={step} onSelect={(n) => setStep(n as Step)} />
        <div className="flex-1" />
        <button
          onClick={onClose}
          title="Cancel"
          className="flex h-8 w-8 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="clide-scroll flex-1 overflow-y-auto px-8 pb-4">
        <div className="flex flex-col gap-4">
          {step === 1 && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[14px] font-bold text-white/70">What should this form do?</label>
                <span className="text-[12px] text-white/40">
                  Describe the goal in a sentence or two — CLIDE will suggest command-line tools and draft the
                  form's fields from this.
                </span>
                <textarea
                  autoFocus
                  className={`${inputBase} min-h-[88px] resize-y`}
                  placeholder="Resize an image to a target width, keeping its aspect ratio…"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[14px] font-bold text-white/70">Name</label>
                  <input
                    className={inputBase}
                    placeholder="Resize Image"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[14px] font-bold text-white/70">Project</label>
                  <input
                    className={inputBase}
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    list="clide-projects"
                  />
                  <datalist id="clide-projects">
                    {projects.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[14px] font-bold text-white/70">
                  AI assistance <span className="font-normal text-white/40">(optional — every step works without it)</span>
                </label>
                <ServiceModelPicker value={serviceModel} onChange={setServiceModel} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <ToolChooser goal={goal} serviceModel={serviceModel} selected={tool} onSelect={selectTool} />

              {tool && (
                <div className="flex flex-col gap-4 border-t border-clide-border pt-4">
                  {tool.spec && tool.spec.subcommands.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-white/30">
                        One action this form does
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {tool.spec.subcommands.map((s) => (
                          <button
                            key={s.name}
                            onClick={() => {
                              setActionName(s.name);
                              setBaseArgsText(s.name);
                            }}
                            className={`rounded px-2.5 py-1 text-[12px] ${
                              actionName === s.name
                                ? "bg-white/10 text-white ring-1 ring-white/20"
                                : "text-white/40 ring-1 ring-white/10 hover:bg-white/5 hover:text-white/70"
                            }`}
                            title={s.description}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[14px] font-bold text-white/70">
                      Fixed base args <span className="font-normal text-white/40">(before the form's own fields)</span>
                    </label>
                    <input
                      className={`${inputBase} font-mono`}
                      placeholder="e.g. convert"
                      value={baseArgsText}
                      onChange={(e) => setBaseArgsText(e.target.value)}
                    />
                    <span className="font-mono text-[12px] text-white/30">
                      {formatCommandPreview(tool.execPath, baseArgs)}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 3 && tool && (
            <>
              {/* Featured command line (ticket 61) — the step's headline. */}
              <div className="flex items-start gap-2 rounded-lg border border-clide-border bg-clide-bg px-3.5 py-3">
                <Terminal size={15} className="mt-0.5 shrink-0 text-white/40" />
                <span className="min-w-0 break-all font-mono text-[13px] text-white/80">{commandPreview}</span>
              </div>

              {staleFieldsHint && (
                <div className="flex items-center gap-2 rounded-md border border-amber-400/30 bg-amber-400/5 px-3 py-2">
                  <RefreshCw size={13} className="shrink-0 text-amber-300" />
                  <span className="min-w-0 flex-1 text-[12px] text-amber-200">
                    These fields were drafted for {draftedFor!.toolName} — the tool is now {tool.name}.
                  </span>
                  {tool.spec && serviceModel.serviceId && (
                    <button
                      onClick={() => void runDraft()}
                      disabled={draftBusy}
                      className="shrink-0 rounded-md bg-amber-400/80 px-2.5 py-1 text-[12px] font-medium text-black hover:bg-amber-400 disabled:opacity-40"
                    >
                      Re-draft
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[13px] text-white/40">
                  One field per input this action needs — the form does one thing well.
                </span>
                {tool.spec && serviceModel.serviceId && (
                  <button
                    onClick={() => void runDraft()}
                    disabled={draftBusy}
                    className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] text-white/50 hover:bg-white/5 hover:text-white disabled:opacity-40"
                  >
                    <Sparkles size={12} className="text-amber-300/70" />
                    {draftBusy ? "Drafting…" : "Re-draft with AI"}
                  </button>
                )}
              </div>
              {draftBusy && fields.length === 0 && (
                <div className="flex items-center gap-2 text-[13px] text-white/60">
                  <Loader size={14} className="animate-spin" />
                  Drafting fields from your goal…
                </div>
              )}
              {draftError && <span className="text-[12px] text-red-400">{draftError}</span>}

              {/* Config left, live preview right (ticket 66); stacked on narrow windows. */}
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                  <CommandFieldsEditor
                    fields={fields}
                    onChange={setFields}
                    toolSpec={tool.spec}
                    openId={openFieldId}
                    onOpenChange={setOpenFieldId}
                  />
                </div>
                <div className="w-full lg:w-[360px] lg:shrink-0">
                  <FormPreview
                    fields={fields}
                    sampleValues={sampleValues}
                    onSampleChange={(id, value) => setSampleValues((prev) => ({ ...prev, [id]: value }))}
                    openId={openFieldId}
                    onOpen={setOpenFieldId}
                  />
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <OutputDefinitionsEditor outputs={outputs} onChange={setOutputs} />
              {unlabeledField && (
                <div className="rounded border border-amber-400/30 bg-amber-400/5 p-3 text-[13px] text-amber-200">
                  A field is missing its label — give it one in the Fields step before creating.
                </div>
              )}
              {createError && (
                <div className="rounded border border-red-500/40 bg-red-500/5 p-3 text-[13px] text-red-300">
                  {createError}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-auto flex shrink-0 items-center border-t border-clide-border px-8 py-4">
        {step > 1 && (
          <button
            disabled={creating}
            onClick={() => setStep((s) => (s - 1) as Step)}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-[12px] font-bold text-white/50 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft size={13} /> BACK
          </button>
        )}
        <div className="flex-1" />
        {step < 4 && (
          <button
            disabled={!reachable[(step + 1) as Step]}
            onClick={() => setStep((s) => (s + 1) as Step)}
            className="flex items-center gap-2 rounded-[3px] border border-white/5 bg-clide-bg px-4 py-1.5 text-[12px] font-bold text-white/70 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            NEXT →
          </button>
        )}
        {step === 4 && (
          <button
            disabled={!canCreate}
            onClick={() => void create()}
            className="flex items-center gap-2 rounded-[3px] border border-white/5 bg-clide-bg px-4 py-1.5 text-[12px] font-bold text-white/70 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? (
              <>
                <Loader size={13} className="animate-spin" /> CREATING…
              </>
            ) : (
              "CREATE FORM"
            )}
          </button>
        )}
      </div>
    </div>
  );
}
