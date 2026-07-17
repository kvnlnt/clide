import { Cloud, HardDrive, Loader, Sparkles } from "lucide-react";
import { useState } from "react";
import { api } from "../rpc";
import { AIServiceEditor } from "./SettingsPanel";
import { useUIFeedback } from "./UIFeedback";
import type { AIService, AIServiceKind } from "../types/forms";

type Step = "choice" | "configure" | "test";

interface FirstRunAIWizardProps {
  /** Quiet escape hatch — closes without registering a service (re-evaluated next launch). */
  onSkip: () => void;
  /** A service now exists — closes the takeover. */
  onDone: () => void;
  /** True when the first-project flow (ticket 78) just chained straight into this step. */
  chained?: boolean;
}

/**
 * Full-window first-run takeover (ticket 76) shown whenever CLIDE has zero
 * registered AI services: CLIDE's features all need one, so this hand-holds
 * a brand-new (or freshly-reset) user through picking a provider, entering
 * credentials, and confirming the connection actually works — reusing the
 * exact same editor and test-connection RPC as the Settings page (ticket 45)
 * rather than a second implementation of that logic.
 */
export default function FirstRunAIWizard({ onSkip, onDone, chained }: FirstRunAIWizardProps) {
  const { toast } = useUIFeedback();
  const [step, setStep] = useState<Step>("choice");
  const [initialKind, setInitialKind] = useState<AIServiceKind>("anthropic");
  const [service, setService] = useState<AIService | null>(null);
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const runTest = async (svc: AIService) => {
    setTesting(true);
    setTestResult(null);
    const res = await api.testAIService(svc.id);
    setTesting(false);
    setTestResult(res);
  };

  const finish = () => {
    toast("AI service connected");
    onDone();
  };

  return (
    <div className="clide-scroll flex flex-1 flex-col items-center overflow-y-auto p-8">
      <div className="flex w-full max-w-[520px] flex-1 flex-col items-center justify-center gap-8 py-10">
        <div className="flex flex-col items-center gap-2 text-center">
          {chained && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Step 2 of 2</span>
          )}
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
            <Sparkles size={20} className="text-amber-300/80" />
          </div>
          <h1 className="text-[26px] font-bold text-white">First things first</h1>
          <p className="max-w-[420px] text-[14px] leading-relaxed text-white/50">
            CLIDE's features — form creation, magic fields, tool inspection — are powered by AI. Connect a service to
            get started. This can be a local model running on your machine, or a remote provider like Claude or
            OpenAI. You can add more or change this anytime in Settings.
          </p>
        </div>

        {step === "choice" && (
          <div className="flex w-full gap-3">
            <button
              onClick={() => {
                setInitialKind("ollama");
                setStep("configure");
              }}
              className="group flex flex-1 flex-col items-start gap-2 rounded-lg border border-white/10 bg-clide-panel/60 p-4 text-left transition-colors hover:border-white/25 hover:bg-white/[0.04]"
            >
              <HardDrive size={18} className="text-white/50 group-hover:text-white" />
              <span className="text-[14px] font-medium text-white">Local</span>
              <span className="text-[12px] text-white/40">
                Private and free — runs on your machine. Needs a local model already installed, like Ollama.
              </span>
            </button>
            <button
              onClick={() => {
                setInitialKind("anthropic");
                setStep("configure");
              }}
              className="group flex flex-1 flex-col items-start gap-2 rounded-lg border border-white/10 bg-clide-panel/60 p-4 text-left transition-colors hover:border-white/25 hover:bg-white/[0.04]"
            >
              <Cloud size={18} className="text-white/50 group-hover:text-white" />
              <span className="text-[14px] font-medium text-white">Remote</span>
              <span className="text-[12px] text-white/40">
                Easiest to set up and most capable — needs an API key from a provider like Claude or OpenAI.
              </span>
            </button>
          </div>
        )}

        {step === "configure" && (
          <div className="w-full">
            <AIServiceEditor
              existing={service ?? undefined}
              hasSavedKey={hasSavedKey}
              initialKind={initialKind}
              onCancel={() => setStep(service ? "test" : "choice")}
              onSave={async (svc, apiKey) => {
                if (apiKey.trim()) {
                  await api.saveServiceCredential(svc.id, apiKey.trim());
                  setHasSavedKey(true);
                }
                const built = { ...svc, isDefault: true };
                await api.saveAIServices([built]);
                setService(built);
                setStep("test");
                void runTest(built);
              }}
            />
          </div>
        )}

        {step === "test" && service && (
          <div className="flex w-full flex-col items-center gap-4 rounded-lg border border-white/10 bg-clide-panel/60 p-5">
            <div className="flex items-center gap-2 text-[14px]">
              {testing ? (
                <span className="flex items-center gap-2 text-white/60">
                  <Loader size={15} className="animate-spin" /> Testing connection…
                </span>
              ) : testResult?.ok ? (
                <span className="text-green-400">Connected — {service.name} is ready</span>
              ) : testResult ? (
                <span className="text-red-400">Couldn't connect: {testResult.error}</span>
              ) : null}
            </div>
            {testResult && !testResult.ok && service.kind === "ollama" && (
              <p className="text-center text-[12px] text-white/40">
                Is Ollama running? Try <span className="font-mono text-white/60">ollama serve</span> in a terminal,
                then test again.
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => void runTest(service)}
                disabled={testing}
                className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white/60 hover:bg-white/5 disabled:opacity-40"
              >
                Test again
              </button>
              <button
                onClick={() => setStep("configure")}
                className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white/60 hover:bg-white/5"
              >
                Edit
              </button>
              <button
                onClick={finish}
                disabled={testing}
                className="rounded-md bg-white/10 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      <button onClick={onSkip} className="shrink-0 pb-2 text-[12px] text-white/30 hover:text-white/60">
        Skip for now
      </button>
    </div>
  );
}
