import { ArrowLeft, Loader, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../rpc";
import type { AIProvider, FormSpecDraft } from "../types/forms";
import { AI_MODELS, DEFAULT_MODEL } from "../types/forms";
import DependencyWarning from "./DependencyWarning";
import SpecEditor from "./SpecEditor";

interface NewFormPageProps {
  onClose: () => void;
}

type Phase = "idle" | "drafting" | "creating" | "error" | "dependency";

const PROVIDERS: { id: AIProvider; label: string }[] = [
  { id: "claude", label: "Claude (Anthropic)" },
  { id: "openai", label: "OpenAI" },
  { id: "ollama", label: "Ollama (local)" },
];

/** Two-step form creation flow: describe (input/processing/output) → AI drafts
 * an editable spec → user fine-tunes → generate from the approved spec. Renders
 * as the pane's page content. On success the new form is dropped into the
 * thread as a ready-to-run card. */
export default function NewFormPage({ onClose }: NewFormPageProps) {
  const { addFormDraft, projects, activeProject } = useApp();

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [inputDesc, setInputDesc] = useState("");
  const [processingDesc, setProcessingDesc] = useState("");
  const [outputDesc, setOutputDesc] = useState("");
  const [project, setProject] = useState(activeProject || projects[0] || "");
  const [provider, setProvider] = useState<AIProvider>("claude");
  const [model, setModel] = useState<string>(DEFAULT_MODEL["claude"]);
  const [apiKey, setApiKey] = useState("");
  const [needsKey, setNeedsKey] = useState(false);
  const [spec, setSpec] = useState<FormSpecDraft | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dependency, setDependency] = useState<{
    name: string;
    instructions?: string;
  } | null>(null);

  // Check whether credentials already exist for the selected provider.
  useEffect(() => {
    let cancelled = false;
    void api.hasCredentials(provider).then((has) => {
      if (!cancelled) setNeedsKey(!has);
    });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  // Reset the model to the provider's default whenever the provider changes.
  useEffect(() => {
    setModel(DEFAULT_MODEL[provider]);
  }, [provider]);

  const busy = phase === "drafting" || phase === "creating";

  const canDraft =
    name.trim().length > 0 &&
    inputDesc.trim().length > 0 &&
    processingDesc.trim().length > 0 &&
    project.trim().length > 0 &&
    (!needsKey || apiKey.trim().length > 0);

  const canGenerate = spec !== null && spec.procedure.trim().length > 0 && spec.outputs.length > 0;

  const draft = async () => {
    setPhase("drafting");
    setError(null);

    if (needsKey && apiKey.trim()) {
      await api.saveCredentials(provider, apiKey.trim());
      setNeedsKey(false);
    }

    const result = await api.draftFormSpec({
      name: name.trim(),
      project: project.trim(),
      input: inputDesc.trim(),
      processing: processingDesc.trim(),
      output: outputDesc.trim(),
      provider,
      model: model.trim() || undefined,
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
      provider,
      model: model.trim() || undefined,
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
    "w-full bg-[rgba(217,217,217,0.05)] text-white text-[13px] rounded px-2.5 py-1.5 outline-none placeholder:text-white/30";

  return (
    <div
      className="clide-scroll flex flex-1 flex-col items-center overflow-y-auto"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className={`flex min-h-full w-full flex-col ${step === 1 ? "max-w-[520px]" : "max-w-[660px]"}`}>
        <div className="flex items-center gap-2 px-6 pb-4 pt-6">
          <Sparkles size={15} className="text-white/70" />
          <span className="text-[14px] font-bold text-white">
            {step === 1 ? "Create new form" : `Fine-tune — ${name.trim() || "new form"}`}
          </span>
          <span className="text-[11px] text-white/30">step {step} of 2</span>
          <div className="flex-1" />
          <button
            onClick={onClose}
            title="Cancel"
            className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 px-6 pb-4">
          {step === 1 && (
            <>
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
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
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
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className="text-[14px] font-bold text-white/70">AI Provider</label>
                  <select
                    className={`${inputBase} appearance-none`}
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as AIProvider)}
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id} className="bg-clide-panel">
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[14px] font-bold text-white/70">Model</label>
                <input
                  className={inputBase}
                  placeholder={DEFAULT_MODEL[provider]}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  list="clide-models"
                />
                <datalist id="clide-models">
                  {AI_MODELS[provider].map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>

              {needsKey && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[14px] font-bold text-white/70">{provider} API Key</label>
                  <input
                    type="password"
                    className={inputBase}
                    placeholder="Stored securely in your system keychain"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
              )}

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

        <div className="mt-auto flex items-center border-t border-clide-border px-6 py-4">
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
    </div>
  );
}
