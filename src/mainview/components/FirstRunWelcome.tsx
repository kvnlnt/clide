import { Check, Loader, MessageCircleQuestion } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../rpc";
import type { StarterTask, UserProfile } from "../types/tasks";
import { isProfileContentEmpty, sectionsToUserProfile, userProfileToSections } from "../types/tasks";
import { NewProjectForm } from "./NewProjectModal";
import { useUIFeedback } from "./UIFeedback";

/**
 * Full-screen first-run onboarding (tickets 78 + 111): the very first thing a
 * brand-new CLIDE install shows. Opens by *interviewing* the person — what
 * they do and what they want from the app — then creates the first project,
 * offers a checklist of ready-to-go starter tasks, and chains into the AI
 * service wizard (ticket 76). AI is a requirement, not a choice: the wizard
 * step only disappears when a service is already configured.
 *
 * Detection first: an existing app profile skips the interview; an already
 * configured AI service skips the wizard step. The interview is deliberately
 * scripted, not AI-generated — it runs before any AI service exists. Its
 * answers land in the app profile so the deeper ticket-100 interview
 * (Settings → Profile) starts ahead.
 */
export default function FirstRunWelcome() {
  const { openAIWizard, completeOnboarding, activeProject, refreshForms, recentProjects } = useApp();
  const { toast } = useUIFeedback();

  type Step = "detect" | "interview" | "project" | "starters";
  const [step, setStep] = useState<Step>("detect");

  // Detection (on mount): who is this, and what's already set up?
  const [prevProfile, setPrevProfile] = useState<UserProfile | null>(null);
  const [hasAI, setHasAI] = useState(false);
  const [starters, setStarters] = useState<StarterTask[]>([]);

  // Interview answers.
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [rolesAnswer, setRolesAnswer] = useState("");
  const [goalsAnswer, setGoalsAnswer] = useState("");

  // Starter checklist.
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    void (async () => {
      const [profile, services, catalog] = await Promise.all([
        api.getUserProfile(),
        api.listAIServices(),
        api.listStarterTasks(),
      ]);
      setPrevProfile(profile);
      setHasAI(services.length > 0);
      setStarters(catalog);
      setChecked(new Set(catalog.map((s) => s.slug)));
      // A saved profile means we've met this person — skip straight to the project.
      setStep(profile ? "project" : "interview");
    })();
  }, []);

  const questions = useMemo(
    () => [
      {
        id: "roles",
        prompt: "What kind of work do you do?",
        hint: "Your job, the hats you wear — however you'd describe it.",
      },
      {
        id: "goals",
        prompt: "What are you hoping CLIDE will take off your plate?",
        hint: "Repetitive chores, publishing steps, scripts you keep re-running…",
      },
    ],
    [],
  );

  // Step position language: interview? → project → starters → AI wizard (unless already configured).
  const stepLabels = useMemo(() => {
    const labels: Step[] = [];
    if (!prevProfile) labels.push("interview");
    labels.push("project", "starters");
    return labels;
  }, [prevProfile]);
  const totalSteps = stepLabels.length + (hasAI ? 0 : 1);
  const stepNumber = Math.max(1, stepLabels.indexOf(step) + 1);

  const saveInterviewProfile = async () => {
    const roles = rolesAnswer.trim();
    const goals = goalsAnswer.trim();
    const sections = userProfileToSections(prevProfile).map((s) => {
      if (s.id === "roles" && roles) return { ...s, value: roles };
      if (s.id === "goals" && goals) return { ...s, value: [goals] };
      return s;
    });
    if (!isProfileContentEmpty(sections)) {
      await api.saveUserProfile(sectionsToUserProfile(sections, prevProfile, {}));
    }
  };

  const submitAnswer = (skip: boolean) => {
    const value = skip ? "" : answer.trim();
    if (questions[questionIndex]!.id === "roles") setRolesAnswer(value);
    else setGoalsAnswer(value);
    setAnswer("");
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex(questionIndex + 1);
      return;
    }
    void saveInterviewProfile();
    setStep("project");
  };

  const finish = () => {
    if (!hasAI) openAIWizard(true);
    completeOnboarding();
  };

  const installSelected = async () => {
    if (!activeProject || checked.size === 0) {
      finish();
      return;
    }
    setInstalling(true);
    const res = await api.installStarterTasks(activeProject, Array.from(checked));
    setInstalling(false);
    if (!res.ok) {
      toast(res.error ?? "Couldn't add the starter tasks", "error");
      return;
    }
    await refreshForms();
    toast(`${checked.size} starter ${checked.size === 1 ? "task" : "tasks"} added`);
    finish();
  };

  const toggleStarter = (slug: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const greeting = recentProjects.length > 0 ? "Welcome back" : "Your Automation Workhorse";

  return (
    <div className="clide-scroll flex flex-1 flex-col items-center justify-center overflow-y-auto p-8">
      {step !== "detect" && (
        <span
          className="clide-rise text-[11px] font-semibold uppercase tracking-wider text-white/30"
          style={{ animationDelay: "0ms" }}
        >
          Step {stepNumber} of {totalSteps}
        </span>
      )}
      <div className="clide-rise mt-2 flex flex-col items-center" style={{ animationDelay: "80ms" }}>
        <h1 className="pt-2 text-[60px] font-bold text-white">CLIDE</h1>
      </div>
      <p className="clide-rise mt-1 text-[23px] italic text-white/30" style={{ animationDelay: "180ms" }}>
        {greeting}
      </p>

      {step === "detect" && (
        <div className="mt-8 flex items-center gap-2 text-[13px] text-white/40">
          <Loader size={14} className="animate-spin" /> Getting things ready…
        </div>
      )}

      {step === "interview" && (
        <div
          className="clide-rise mt-8 w-[460px] rounded-lg border border-white/10 bg-clide-panel/60 p-5"
          style={{ animationDelay: "380ms" }}
        >
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-white/30">
              First, a quick hello — {questionIndex + 1} of {questions.length}
            </span>
            <div className="flex items-start gap-2 text-[15px] text-white">
              <MessageCircleQuestion size={16} className="mt-0.5 shrink-0 text-amber-300/70" />
              <span>{questions[questionIndex]!.prompt}</span>
            </div>
            <p className="text-[12px] text-white/40">{questions[questionIndex]!.hint}</p>
            <textarea
              autoFocus
              rows={3}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (answer.trim()) submitAnswer(false);
                }
              }}
              placeholder="Type your answer… (⌘↵ to continue)"
              className="clide-scroll w-full resize-y rounded-md border border-clide-border bg-clide-bg px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30"
            />
            <div className="flex items-center justify-between">
              <button
                onClick={() => submitAnswer(true)}
                className="rounded-md px-3 py-1.5 text-[12px] text-white/50 hover:bg-white/5 hover:text-white"
              >
                Skip
              </button>
              <button
                onClick={() => submitAnswer(false)}
                disabled={!answer.trim()}
                className="rounded-md bg-white/10 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "project" && (
        <div
          className="clide-rise mt-8 w-[420px] overflow-hidden rounded-lg border border-white/10 bg-clide-panel/60"
          style={{ animationDelay: "380ms" }}
        >
          <NewProjectForm onDone={() => setStep("starters")} />
        </div>
      )}

      {step === "starters" && (
        <div
          className="clide-rise mt-8 flex w-[460px] flex-col gap-3 rounded-lg border border-white/10 bg-clide-panel/60 p-5"
          style={{ animationDelay: "80ms" }}
        >
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-semibold text-white">Ready-to-go tasks</span>
            <p className="text-[12px] leading-relaxed text-white/40">
              {goalsAnswer.trim()
                ? `You said you're after: “${goalsAnswer.trim()}”. These starters give you something runnable right away — keep the ones that fit.`
                : "A few runnable starters so the project isn't empty — keep the ones that look useful."}
            </p>
          </div>
          <div className="flex flex-col divide-y divide-white/5 rounded-md border border-white/5">
            {starters.map((s) => (
              <button
                key={s.slug}
                onClick={() => toggleStarter(s.slug)}
                className="flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    checked.has(s.slug) ? "border-white/40 bg-white/20" : "border-white/20"
                  }`}
                >
                  {checked.has(s.slug) && <Check size={11} className="text-white" />}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13px] text-white">{s.name}</span>
                  <span className="truncate text-[11px] text-white/40">{s.description}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={finish}
              disabled={installing}
              className="rounded-md px-3 py-1.5 text-[12px] text-white/50 hover:bg-white/5 hover:text-white disabled:opacity-40"
            >
              Skip
            </button>
            <button
              onClick={() => void installSelected()}
              disabled={installing}
              className="flex items-center gap-2 rounded-md bg-white/10 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
            >
              {installing && <Loader size={13} className="animate-spin" />}
              {checked.size > 0 ? `Add ${checked.size} ${checked.size === 1 ? "task" : "tasks"} & continue` : "Continue"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
