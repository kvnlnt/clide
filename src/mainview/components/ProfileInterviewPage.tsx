import { Loader, MessageCircleQuestion, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../rpc";
import type { InterviewTurn, ProfileScope, ProfileSection } from "../types/tasks";
import { isProfileContentEmpty, sectionsToProjectProfile, sectionsToUserProfile } from "../types/tasks";
import { useUIFeedback } from "./UIFeedback";

interface ProfileInterviewPageProps {
  scope: ProfileScope;
  /** Required when scope === "project". */
  projectPath?: string;
  projectName?: string;
  /** saved=true when a profile was written — callers refresh their profile views. */
  onClose: (saved: boolean) => void;
}

type Phase = "asking" | "drafting" | "review" | "saving";

/**
 * Full-window AI profile interview (tickets 100/101), same takeover mechanic
 * as Settings/the first-run wizard: chat transcript, one active question, a
 * text answer box with Skip / Finish controls, ending on an editable review
 * screen with an explicit Save. Closing mid-interview discards the transcript
 * and leaves the profile untouched.
 */
export default function ProfileInterviewPage({ scope, projectPath, projectName, onClose }: ProfileInterviewPageProps) {
  const { toast } = useUIFeedback();
  const [phase, setPhase] = useState<Phase>("asking");
  const [transcript, setTranscript] = useState<InterviewTurn[]>([]);
  const [question, setQuestion] = useState<string | null>(null);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [answer, setAnswer] = useState("");
  const [sections, setSections] = useState<ProfileSection[]>([]);
  const [selfNotes, setSelfNotes] = useState("");
  const [suggestApp, setSuggestApp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answerRef = useRef<HTMLTextAreaElement | null>(null);

  const title = scope === "app" ? "Getting to know you" : `About "${projectName ?? "this project"}"`;

  const finish = useCallback(
    async (t: InterviewTurn[]) => {
      setPhase("drafting");
      setError(null);
      const res = await api.profileInterviewFinish(scope, projectPath, t);
      if (!res.ok || !res.sections) {
        setError(res.error ?? "Couldn't draft the profile.");
        setPhase("asking");
        return;
      }
      setSections(res.sections);
      setSelfNotes(res.selfNotes ?? "");
      setSuggestApp(res.suggestAppInterview === true);
      setPhase("review");
    },
    [scope, projectPath],
  );

  const fetchNext = useCallback(
    async (t: InterviewTurn[]) => {
      setLoadingQuestion(true);
      setError(null);
      const res = await api.profileInterviewNext(scope, projectPath, t);
      setLoadingQuestion(false);
      if (!res.ok) {
        setError(res.error ?? "Couldn't generate a question.");
        return;
      }
      if (res.done || !res.question) {
        // The engine ended the session on its own — draft from what was gathered.
        if (t.length > 0) void finish(t);
        else setError("The interview couldn't get started — try again later.");
        return;
      }
      setQuestion(res.question);
      setCategory(res.category);
      answerRef.current?.focus();
    },
    [scope, projectPath, finish],
  );

  useEffect(() => {
    void fetchNext([]);
    // Mount-only: the interview restarts only with a fresh page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitAnswer = (skip: boolean) => {
    if (!question || loadingQuestion) return;
    const turn: InterviewTurn = { question, answer: skip ? "" : answer.trim(), category };
    const next = [...transcript, turn];
    setTranscript(next);
    setAnswer("");
    setQuestion(null);
    setCategory(undefined);
    void fetchNext(next);
  };

  const save = async () => {
    setPhase("saving");
    if (scope === "app") {
      const prev = await api.getUserProfile();
      const res = await api.saveUserProfile(sectionsToUserProfile(sections, prev, { interviewed: true, selfNotes }));
      if (!res.ok) {
        setError(res.error ?? "Couldn't save the profile.");
        setPhase("review");
        return;
      }
    } else {
      const prev = await api.getProjectProfile(projectPath!);
      const res = await api.saveProjectProfile(
        projectPath!,
        sectionsToProjectProfile(sections, prev, { interviewed: true, selfNotes }),
      );
      if (!res.ok) {
        setError(res.error ?? "Couldn't save the profile.");
        setPhase("review");
        return;
      }
    }
    toast("Profile saved");
    onClose(true);
  };

  const updateSection = (id: string, raw: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, value: s.kind === "list" ? raw.split("\n").map((v) => v.trimEnd()) : raw } : s,
      ),
    );
  };

  const empty = isProfileContentEmpty(sections);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between px-8 pb-4 pt-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
            <Sparkles size={15} className="text-amber-300/80" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-[17px] font-bold text-white">{title}</h1>
            <span className="text-[11px] text-white/30">
              Answers stay on this machine — they're only sent within your own AI service calls.
            </span>
          </div>
        </div>
        <button
          onClick={() => onClose(false)}
          title="Close (discards this session)"
          className="flex h-8 w-8 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="clide-scroll flex-1 overflow-y-auto px-8 pb-8">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
          {(phase === "asking" || phase === "drafting") && (
            <>
              {transcript.map((turn, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex items-start gap-2 text-[13px] text-white/70">
                    <MessageCircleQuestion size={14} className="mt-0.5 shrink-0 text-white/30" />
                    <span>
                      {turn.category && (
                        <span className="mr-2 text-[10px] font-medium uppercase tracking-wide text-white/30">
                          {turn.category}
                        </span>
                      )}
                      {turn.question}
                    </span>
                  </div>
                  <div className="ml-6 rounded-md bg-white/[0.03] px-3 py-1.5 text-[13px] text-white/50">
                    {turn.answer || <span className="italic text-white/25">Skipped</span>}
                  </div>
                </div>
              ))}

              {phase === "drafting" ? (
                <div className="flex items-center gap-2 pt-2 text-[13px] text-white/50">
                  <Loader size={14} className="animate-spin" /> Drafting your profile…
                </div>
              ) : loadingQuestion ? (
                <div className="flex items-center gap-2 pt-2 text-[13px] text-white/50">
                  <Loader size={14} className="animate-spin" /> Thinking…
                </div>
              ) : question ? (
                <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-clide-panel/60 p-4">
                  {category && (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-amber-300/60">
                      {category}
                    </span>
                  )}
                  <div className="flex items-start gap-2 text-[14px] text-white">
                    <MessageCircleQuestion size={15} className="mt-0.5 shrink-0 text-amber-300/70" />
                    <span>{question}</span>
                  </div>
                  <textarea
                    ref={answerRef}
                    autoFocus
                    rows={3}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        submitAnswer(false);
                      }
                    }}
                    placeholder="Type your answer… (⌘↵ to send)"
                    className="clide-scroll w-full resize-y rounded-md border border-clide-border bg-clide-bg px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30"
                  />
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => submitAnswer(true)}
                      className="rounded-md px-3 py-1.5 text-[12px] text-white/50 hover:bg-white/5 hover:text-white"
                    >
                      Skip this one
                    </button>
                    <div className="flex gap-2">
                      {transcript.length > 0 && (
                        <button
                          onClick={() => void finish(transcript)}
                          className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white/60 hover:bg-white/5 hover:text-white"
                        >
                          Finish early
                        </button>
                      )}
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
              ) : null}
            </>
          )}

          {(phase === "review" || phase === "saving") && (
            <>
              <p className="text-[13px] text-white/50">
                Here's the draft — every section is yours to edit before saving. Nothing is stored until you save.
              </p>
              {suggestApp && (
                <p className="rounded-md border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-[12px] text-amber-200/80">
                  Tip: you haven't built an app-level profile yet. An interview about <em>you</em> (Settings →
                  Profile) makes every project smarter.
                </p>
              )}
              {sections.map((s) => (
                <div key={s.id} className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-white/60">
                    {s.label}
                    {s.kind === "list" && <span className="ml-1.5 text-white/30">one per line</span>}
                  </label>
                  <textarea
                    rows={s.kind === "list" ? 3 : 2}
                    value={Array.isArray(s.value) ? s.value.join("\n") : s.value}
                    onChange={(e) => updateSection(s.id, e.target.value)}
                    className="clide-scroll w-full resize-y rounded-md border border-clide-border bg-clide-surface px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30"
                  />
                </div>
              ))}
              {empty && (
                <p className="text-[12px] italic text-white/40">
                  Nothing was gathered — an empty profile won't be saved.
                </p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => void save()}
                  disabled={phase === "saving" || empty}
                  className="rounded-md bg-white/10 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
                >
                  {phase === "saving" ? "Saving…" : "Save profile"}
                </button>
                <button
                  onClick={() => onClose(false)}
                  disabled={phase === "saving"}
                  className="rounded-md px-3 py-1.5 text-[12px] text-white/50 hover:bg-white/5 hover:text-white disabled:opacity-40"
                >
                  Discard
                </button>
              </div>
            </>
          )}

          {error && <span className="text-[12px] text-red-400">{error}</span>}
        </div>
      </div>
    </div>
  );
}

interface ProfileOfferCardProps {
  title: string;
  body: string;
  onAccept: () => void;
  onDismiss: () => void;
}

/** Gentle, dismissible profile-interview offer (tickets 100 §3 / 101 §3) — never blocks the thread. */
export function ProfileOfferCard({ title, body, onAccept, onDismiss }: ProfileOfferCardProps) {
  return (
    <div className="absolute bottom-6 right-6 z-40 flex w-[320px] flex-col gap-2 rounded-lg border border-white/10 bg-clide-panel p-4 shadow-xl">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="shrink-0 text-amber-300/80" />
        <span className="text-[13px] font-semibold text-white">{title}</span>
      </div>
      <p className="text-[12px] leading-relaxed text-white/50">{body}</p>
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onDismiss}
          className="rounded-md px-2.5 py-1 text-[12px] text-white/40 hover:bg-white/5 hover:text-white/70"
        >
          Not now
        </button>
        <button
          onClick={onAccept}
          className="rounded-md bg-white/10 px-3 py-1 text-[12px] font-medium text-white hover:bg-white/20"
        >
          Interview me
        </button>
      </div>
    </div>
  );
}
