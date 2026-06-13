import { Loader, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../rpc";
import type { AIProvider } from "../types/forms";
import { AI_MODELS, DEFAULT_MODEL } from "../types/forms";
import DependencyWarning from "./DependencyWarning";

interface NewFormCardProps {
  draftId: string;
  defaultProject: string;
}

type Phase = "idle" | "creating" | "error" | "dependency";

const PROVIDERS: { id: AIProvider; label: string }[] = [
  { id: "claude", label: "Claude (Anthropic)" },
  { id: "openai", label: "OpenAI" },
  { id: "ollama", label: "Ollama (local)" },
];

export default function NewFormCard({ draftId, defaultProject }: NewFormCardProps) {
  const { removeDraft, addFormDraft, projects } = useApp();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState(defaultProject || projects[0] || "");
  const [provider, setProvider] = useState<AIProvider>("claude");
  const [model, setModel] = useState<string>(DEFAULT_MODEL["claude"]);
  const [apiKey, setApiKey] = useState("");
  const [needsKey, setNeedsKey] = useState(false);

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

  const canSubmit =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    project.trim().length > 0 &&
    (!needsKey || apiKey.trim().length > 0);

  const submit = async () => {
    setPhase("creating");
    setError(null);
    setDependency(null);

    if (needsKey && apiKey.trim()) {
      await api.saveCredentials(provider, apiKey.trim());
      setNeedsKey(false);
    }

    const result = await api.createForm({
      name: name.trim(),
      description: description.trim(),
      project: project.trim(),
      provider,
      model: model.trim() || undefined,
    });

    if (result.ok && result.slug) {
      removeDraft(draftId);
      // Replace this creation card with the newly created form, ready to run.
      addFormDraft(result.slug);
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
    <div className="overflow-hidden rounded-[5px] border border-clide-border bg-clide-surface">
      <div className="flex items-center gap-2 px-4 py-3">
        <Sparkles size={15} className="text-white/70" />
        <span className="text-[12px] font-medium text-white">Create new form</span>
        <div className="flex-1" />
        <button className="text-[12px] text-white/40 hover:text-white" onClick={() => removeDraft(draftId)}>
          Cancel
        </button>
      </div>
      <div className="h-px bg-clide-border" />

      <div className="flex flex-col gap-4 px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[14px] font-bold text-white/70">Name</label>
          <input
            className={inputBase}
            placeholder="Create Media Post"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[14px] font-bold text-white/70">Description — what should this form do?</label>
          <textarea
            className={`${inputBase} min-h-[72px] resize-y`}
            placeholder="Resize an image to a target width using ffmpeg..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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

        {phase === "creating" && (
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
            onRetry={() => void submit()}
            onSkip={() => {
              setPhase("idle");
              setDependency(null);
            }}
          />
        )}
      </div>

      <div className="h-px bg-clide-border" />
      <div className="flex justify-end px-4 py-3">
        <button
          disabled={!canSubmit || phase === "creating"}
          onClick={() => void submit()}
          className="flex items-center gap-2 rounded-[3px] border border-white/5 bg-clide-panel px-4 py-1.5 text-[12px] font-bold text-white/70 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {phase === "creating" ? "CREATING…" : "CREATE FORM"}
        </button>
      </div>
    </div>
  );
}
