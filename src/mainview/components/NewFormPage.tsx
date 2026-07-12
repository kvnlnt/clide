import { ArrowLeft, Loader, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../rpc";
import CommandFieldsEditor from "./CommandFieldsEditor";
import ServiceModelPicker, { type ServiceModelValue } from "./ServiceModelPicker";
import { OutputsSection, TagEditor } from "./SpecEditor";
import ToolFinder from "./ToolFinder";
import { buildCommand, formatCommandPreview } from "../types/forms";
import type { FormEvents, FormField, OutputSpec, OutputType, ToolRegistryEntry } from "../types/forms";

interface NewFormPageProps {
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4;

const STEP_LABEL: Record<Step, string> = {
  1: "Find the tool",
  2: "Scope the action",
  3: "Fields",
  4: "Output & events",
};

/** Representative placeholder values so the command preview shows argv shape while designing, not real data. */
function previewInputs(fields: FormField[]): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  for (const f of fields) {
    if (!f.argMapping) continue;
    if (f.argMapping.kind === "flag") {
      inputs[f.id] = true;
      continue;
    }
    const placeholder = `<${f.label || f.id}>`;
    inputs[f.id] = f.argMapping.repeat ? [placeholder] : placeholder;
  }
  return inputs;
}

/**
 * Command-backed form creation wizard (ticket 54): find an installed CLI
 * tool → scope one action → fields (AI-drafted, always overridable) → output
 * & events. Every step works fully manually; AI accelerates but never gates.
 */
export default function NewFormPage({ onClose }: NewFormPageProps) {
  const { addFormDraft, projects, activeProject } = useApp();

  const [stepState, setStepState] = useState<Step>(1);
  const [serviceModel, setServiceModel] = useState<ServiceModelValue>({ serviceId: "", model: "" });

  // Step 1
  const [tool, setTool] = useState<ToolRegistryEntry | null>(null);

  // Step 2
  const [actionName, setActionName] = useState("");
  const [baseArgsText, setBaseArgsText] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState(activeProject || projects[0] || "");

  // Step 3
  const [fields, setFields] = useState<FormField[]>([]);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  // Step 4
  const [outputs, setOutputs] = useState<OutputSpec[]>([{ kind: "text" }]);
  const [events, setEvents] = useState<FormEvents>({ emits: [], listensFor: [] });

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const selectTool = (t: ToolRegistryEntry) => {
    setTool(t);
    setName((n) => n || t.name);
    setDescription((d) => d || t.spec?.description || "");
    setStepState(2);
  };

  const selectAction = (subcommandName: string, subcommandDescription: string) => {
    setActionName(subcommandName);
    setBaseArgsText(subcommandName);
    if (subcommandDescription) setDescription(subcommandDescription);
  };

  const baseArgs = baseArgsText.trim() ? baseArgsText.trim().split(/\s+/) : [];

  const goToFields = () => setStepState(3);

  const aiDraftFields = async () => {
    if (!tool?.spec || !serviceModel.serviceId) return;
    setDraftBusy(true);
    setDraftError(null);
    const res = await api.draftCommandFields(tool.name, actionName || tool.name, tool.spec, serviceModel.serviceId, serviceModel.model);
    setDraftBusy(false);
    if (!res.ok || !res.fields) {
      setDraftError(res.error ?? "Couldn't draft fields.");
      return;
    }
    setFields(res.fields);
  };

  const create = async () => {
    if (!tool || !name.trim() || !project.trim()) return;
    setCreating(true);
    setCreateError(null);
    const outputType = (outputs.find((o) => o.kind !== "effect")?.kind as OutputType | undefined) ?? "text";
    const res = await api.createCommandForm({
      project: project.trim(),
      name: name.trim(),
      description: description.trim(),
      tags: [],
      command: { tool: tool.execPath, baseArgs },
      fields,
      outputType,
      outputs,
      events,
    });
    setCreating(false);
    if (res.ok && res.slug) {
      addFormDraft(res.slug);
      onClose();
      return;
    }
    setCreateError(res.error ?? "Failed to create form");
  };

  const canProceedStep2 = name.trim().length > 0 && project.trim().length > 0;
  const canCreate = name.trim().length > 0 && project.trim().length > 0 && !creating;

  const inputBase =
    "w-full rounded border border-clide-border bg-clide-surface text-white text-[13px] px-2.5 py-1.5 outline-none placeholder:text-white/30 focus:border-white/30";
  const previewCommand = tool ? formatCommandPreview(tool.execPath, buildCommand({ fields, outputType: "text", command: { tool: tool.execPath, baseArgs } }, previewInputs(fields)).argv) : "";

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="flex shrink-0 items-baseline gap-2 px-8 pb-4 pt-7">
        <h1 className="text-[20px] font-bold text-white">
          {stepState === 1 ? "Create new form" : `${STEP_LABEL[stepState]} — ${name || tool?.name || "new form"}`}
        </h1>
        <span className="text-[13px] text-white/40">step {stepState} of 4</span>
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
          {stepState === 1 && (
            <ToolFinder serviceModel={serviceModel} onServiceModelChange={setServiceModel} onSelect={selectTool} />
          )}

          {stepState === 2 && tool && (
            <>
              {tool.spec && tool.spec.subcommands.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white/30">
                    One action this form does
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {tool.spec.subcommands.map((s) => (
                      <button
                        key={s.name}
                        onClick={() => selectAction(s.name, s.description)}
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[14px] font-bold text-white/70">Name</label>
                  <input autoFocus className={inputBase} value={name} onChange={(e) => setName(e.target.value)} />
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
                <label className="text-[14px] font-bold text-white/70">Description</label>
                <textarea
                  className={`${inputBase} min-h-[56px] resize-y`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

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
            </>
          )}

          {stepState === 3 && tool && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-white/40">
                  One field per input this action needs — the form does one thing well.
                </span>
                {tool.spec && (
                  <div className="flex items-center gap-2">
                    <ServiceModelPicker value={serviceModel} onChange={setServiceModel} />
                    <button
                      onClick={() => void aiDraftFields()}
                      disabled={draftBusy || !serviceModel.serviceId}
                      className="flex shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
                    >
                      <Sparkles size={13} className="text-amber-300" />
                      {draftBusy ? "Drafting…" : "AI-draft fields"}
                    </button>
                  </div>
                )}
              </div>
              {draftError && <span className="text-[12px] text-red-400">{draftError}</span>}

              <CommandFieldsEditor fields={fields} onChange={setFields} />

              <div className="flex items-start gap-1.5 rounded-md border border-clide-border bg-clide-bg px-2.5 py-2 font-mono text-[12px] text-white/60">
                <span className="min-w-0 break-all">{previewCommand}</span>
              </div>
            </>
          )}

          {stepState === 4 && (
            <>
              <OutputsSection outputs={outputs} onChange={setOutputs} />
              <TagEditor
                label="Emits"
                hint="Events fired when a run succeeds — e.g. media:created"
                tags={events.emits}
                onChange={(emits) => setEvents({ ...events, emits })}
              />
              <TagEditor
                label="Listens for"
                hint="Events that auto-submit this form"
                tags={events.listensFor}
                onChange={(listensFor) => setEvents({ ...events, listensFor })}
              />
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
        {stepState > 1 && (
          <button
            disabled={creating}
            onClick={() => setStepState((s) => (s - 1) as Step)}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-[12px] font-bold text-white/50 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft size={13} /> BACK
          </button>
        )}
        <div className="flex-1" />
        {stepState === 2 && (
          <button
            disabled={!canProceedStep2}
            onClick={goToFields}
            className="flex items-center gap-2 rounded-[3px] border border-white/5 bg-clide-bg px-4 py-1.5 text-[12px] font-bold text-white/70 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            NEXT →
          </button>
        )}
        {stepState === 3 && (
          <button
            onClick={() => setStepState(4)}
            className="flex items-center gap-2 rounded-[3px] border border-white/5 bg-clide-bg px-4 py-1.5 text-[12px] font-bold text-white/70 transition-colors hover:text-white"
          >
            NEXT →
          </button>
        )}
        {stepState === 4 && (
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
