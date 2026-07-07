import { ArrowLeft, Loader, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../rpc";
import type { AIService, FormSpecDraft } from "../types/forms";
import DependencyWarning from "./DependencyWarning";
import SpecEditor from "./SpecEditor";

interface NewFormPageProps {
  onClose: () => void;
}

type Phase = "idle" | "drafting" | "creating" | "error" | "dependency";

const NEEDS_KEY_KINDS = new Set(["anthropic", "openai"]);

/** Two-step form creation flow: describe (input/processing/output) → AI drafts
 * an editable spec → user fine-tunes → generate from the approved spec. Renders
 * as the pane's full-width page content. On success the new form is dropped
 * into the thread as a ready-to-run card. */
export default function NewFormPage({ onClose }: NewFormPageProps) {
  const { addFormDraft, projects, activeProject, openAppSettings } = useApp();

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [inputDesc, setInputDesc] = useState("");
  const [processingDesc, setProcessingDesc] = useState("");
  const [outputDesc, setOutputDesc] = useState("");
  const [project, setProject] = useState(activeProject || projects[0] || "");
  const [services, setServices] = useState<AIService[] | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [needsKey, setNeedsKey] = useState(false);
  const [spec, setSpec] = useState<FormSpecDraft | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dependency, setDependency] = useState<{
    name: string;
    instructions?: string;
  } | null>(null);

  const selectedService = services?.find((s) => s.id === serviceId);

  useEffect(() => {
    void api.listAIServices().then((list) => {
      setServices(list);
      const preferred = list.find((s) => s.isDefault) ?? list[0];
      if (preferred) setServiceId(preferred.id);
    });
  }, []);

  // Check whether credentials already exist for the selected service.
  useEffect(() => {
    if (!selectedService) {
      setNeedsKey(false);
      return;
    }
    if (!NEEDS_KEY_KINDS.has(selectedService.kind)) {
      setNeedsKey(false);
      return;
    }
    let cancelled = false;
    void api.hasServiceCredential(selectedService.id).then((has) => {
      if (!cancelled) setNeedsKey(!has);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedService]);

  const busy = phase === "drafting" || phase === "creating";

  const canDraft =
    name.trim().length > 0 &&
    inputDesc.trim().length > 0 &&
    processingDesc.trim().length > 0 &&
    project.trim().length > 0 &&
    serviceId.length > 0 &&
    (!needsKey || apiKey.trim().length > 0);

  const canGenerate = spec !== null && spec.procedure.trim().length > 0 && spec.outputs.length > 0;

  const draft = async () => {
    setPhase("drafting");
    setError(null);

    if (needsKey && apiKey.trim()) {
      await api.saveServiceCredential(serviceId, apiKey.trim());
      setNeedsKey(false);
    }

    const result = await api.draftFormSpec({
      name: name.trim(),
      project: project.trim(),
      input: inputDesc.trim(),
      processing: processingDesc.trim(),
      output: outputDesc.trim(),
      serviceId,
    });

    if (result.ok && result.spec) {
      setSpec(result.spec);
      setStep(2);
      setPhase("idle");
      return;
    }
    setError(result.error ?? "Failed to draft form spec");
    setPhase("error");
  };

  const generate = async () => {
    if (!spec) return;
    setPhase("creating");
    setError(null);
    setDependency(null);

    const result = await api.createForm({
      name: name.trim(),
      description: processingDesc.trim(),
      project: project.trim(),
      serviceId,
      spec,
    });

    if (result.ok && result.slug) {
      // Drop the newly created form into the thread, ready to run.
      addFormDraft(result.slug);
      onClose();
      return;
    }
    if (result.dependencyMissing) {
      setDependency({
        name: result.dependencyMissing,
        instructions: result.installInstructions,
      });
      setPhase("dependency");
      return;
    }
    setError(result.error ?? "Failed to create form");
    setPhase("error");
  };

  const inputBase =
    "w-full rounded border border-clide-border bg-clide-surface text-white text-[13px] px-2.5 py-1.5 outline-none placeholder:text-white/30 focus:border-white/30";

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="flex shrink-0 items-baseline gap-2 px-8 pb-4 pt-7">
        <h1 className="text-[20px] font-bold text-white">
          {step === 1 ? "Create new form" : `Fine-tune — ${name.trim() || "new form"}`}
        </h1>
        <span className="text-[13px] text-white/40">step {step} of 2</span>
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
              {services?.length === 0 && (
                <div className="flex items-center justify-between gap-3 rounded border border-amber-500/40 bg-amber-500/5 p-3 text-[13px] text-amber-200">
                  <span>No AI services configured yet.</span>
                  <button
                    onClick={openAppSettings}
                    className="shrink-0 rounded bg-white/10 px-3 py-1 text-[12px] font-medium text-white hover:bg-white/20"
                  >
                    Add one in Settings
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[14px] font-bold text-white/70">Name</label>
                  <input
                    autoFocus
                    className={inputBase}
                    placeholder="Create Media Post"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[14px] font-bold text-white/70">Project</label>
                  <input
                    className={inputBase}
                    placeholder="Utilities"
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
                <div className="flex flex-col gap-1.5">
                  <label className="text-[14px] font-bold text-white/70">AI Service</label>
                  <select
                    className={`${inputBase} appearance-none`}
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    disabled={!services || services.length === 0}
                  >
                    {(services ?? []).map((s) => (
                      <option key={s.id} value={s.id} className="bg-clide-panel">
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {needsKey && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[14px] font-bold text-white/70">
                      {selectedService?.name} API Key
                    </label>
                    <input
                      type="password"
                      className={inputBase}
                      placeholder="Stored securely in your system keychain"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[14px] font-bold text-white/70">Input — what information does it collect?</label>
                <textarea
                  className={`${inputBase} min-h-[56px] resize-y`}
                  placeholder="An image file and a target width in pixels..."
                  value={inputDesc}
                  onChange={(e) => setInputDesc(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[14px] font-bold text-white/70">Processing — what should the script do?</label>
                <textarea
                  className={`${inputBase} min-h-[56px] resize-y`}
                  placeholder="Resize the image to the target width using ffmpeg, keeping aspect ratio..."
                  value={processingDesc}
                  onChange={(e) => setProcessingDesc(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[14px] font-bold text-white/70">
                  Output — what does it produce or affect? <span className="font-normal text-white/40">(optional)</span>
                </label>
                <textarea
                  className={`${inputBase} min-h-[56px] resize-y`}
                  placeholder="The resized image, and it updates the media index..."
                  value={outputDesc}
                  onChange={(e) => setOutputDesc(e.target.value)}
                />
              </div>

              {phase === "drafting" && (
                <div className="flex items-center gap-2 text-[13px] text-white/60">
                  <Loader size={14} className="animate-spin" />
                  Drafting form spec…
                </div>
              )}
            </>
          )}

          {step === 2 && spec && <SpecEditor spec={spec} onChange={setSpec} />}

          {step === 2 && phase === "creating" && (
            <div className="flex items-center gap-2 text-[13px] text-white/60">
              <Loader size={14} className="animate-spin" />
              Generating script and form definition…
            </div>
          )}

          {phase === "error" && error && (
            <div className="rounded border border-red-500/40 bg-red-500/5 p-3 text-[13px] text-red-300">{error}</div>
          )}

          {phase === "dependency" && dependency && (
            <DependencyWarning
              dependency={dependency.name}
              installInstructions={dependency.instructions}
              onRetry={() => void generate()}
              onSkip={() => {
                setPhase("idle");
                setDependency(null);
              }}
            />
          )}
        </div>
      </div>

      <div className="mt-auto flex shrink-0 items-center border-t border-clide-border px-8 py-4">
        {step === 2 && (
          <button
            disabled={busy}
            onClick={() => {
              setStep(1);
              setPhase("idle");
              setError(null);
              setDependency(null);
            }}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-[12px] font-bold text-white/50 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft size={13} /> BACK
          </button>
        )}
        <div className="flex-1" />
        {step === 1 ? (
          <button
            disabled={!canDraft || busy}
            onClick={() => void draft()}
            className="flex items-center gap-2 rounded-[3px] border border-white/5 bg-clide-bg px-4 py-1.5 text-[12px] font-bold text-white/70 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {phase === "drafting" ? "DRAFTING…" : "DRAFT FORM →"}
          </button>
        ) : (
          <button
            disabled={!canGenerate || busy}
            onClick={() => void generate()}
            className="flex items-center gap-2 rounded-[3px] border border-white/5 bg-clide-bg px-4 py-1.5 text-[12px] font-bold text-white/70 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {phase === "creating" ? "GENERATING…" : "GENERATE FORM"}
          </button>
        )}
      </div>
    </div>
  );
}
