import {
  APP_PROFILE_SECTIONS,
  PROJECT_PROFILE_SECTIONS,
  capSelfNotes,
  type ProfileSectionSpec,
} from "../../shared/profile";
import type {
  AIService,
  InterviewTurn,
  ProfileAmendment,
  ProfileScope,
  ProfileSection,
} from "../../shared/types";
import { complete } from "./providers";

// Turn-based profile interview engine (ticket 100). Scope-agnostic: given a
// profile schema (section specs), the existing profile and the AI's own
// selfNotes, it generates the next question, drafts a profile from the
// transcript, critiques its own session, and reflects over usage — ticket 101
// runs the same engine with the project schema.

/** Hard cap per session (§2): the model may end earlier, never later. */
export const MAX_INTERVIEW_QUESTIONS = 8;
const MIN_QUESTIONS_BEFORE_DONE = 5;

export interface InterviewContext {
  scope: ProfileScope;
  /** Display name of the project when scope === "project". */
  projectName?: string;
  /** Current profile rendered as sections (blank values when none exists). */
  existing: ProfileSection[];
  /** True when a saved profile exists — switches to delta questioning. */
  hasProfile: boolean;
  /** The engine's accumulated notes-to-self about its own interviewing (§4). */
  selfNotes: string;
  /** Project scope: compact app-profile block (what's already known), or null. */
  appProfileBlock: string | null;
  /** Project scope: the app profile as sections, for cross-scope amendments. */
  appSections?: ProfileSection[];
}

function specsFor(scope: ProfileScope): ProfileSectionSpec[] {
  return scope === "app" ? APP_PROFILE_SECTIONS : PROJECT_PROFILE_SECTIONS;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI response did not contain JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function sectionCatalog(specs: ProfileSectionSpec[]): string {
  return specs
    .map((s) => `- ${s.id} (${s.kind === "list" ? "list of short items" : "prose"}): ${s.hint}`)
    .join("\n");
}

function renderSections(sections: ProfileSection[]): string {
  const lines = sections
    .map((s) => {
      const value = Array.isArray(s.value) ? s.value.filter((v) => v.trim()).join("; ") : s.value.trim();
      return value ? `${s.label}: ${value}` : null;
    })
    .filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : "(empty)";
}

function renderTranscript(transcript: InterviewTurn[]): string {
  if (transcript.length === 0) return "(no questions asked yet)";
  return transcript
    .map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer.trim() || "(skipped)"}`)
    .join("\n");
}

function subjectLine(ctx: InterviewContext): string {
  return ctx.scope === "app"
    ? "The interview builds an app-level profile of the user themselves."
    : `The interview builds a profile of the project "${ctx.projectName ?? "this project"}" — not of the user in general.`;
}

function commonContext(ctx: InterviewContext, transcript: InterviewTurn[]): string {
  return [
    `Profile sections to fill:\n${sectionCatalog(specsFor(ctx.scope))}`,
    `Existing profile:\n${renderSections(ctx.existing)}`,
    ctx.appProfileBlock ? `Already known about the user (app profile):\n${ctx.appProfileBlock}` : null,
    ctx.selfNotes ? `Your own notes from previous sessions:\n${ctx.selfNotes}` : null,
    `Session transcript so far:\n${renderTranscript(transcript)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Next question, or done. Enforces the question cap regardless of the model's opinion. */
export async function nextInterviewQuestion(
  service: AIService,
  ctx: InterviewContext,
  transcript: InterviewTurn[],
): Promise<{ question: string | null }> {
  if (transcript.length >= MAX_INTERVIEW_QUESTIONS) return { question: null };

  const system = [
    "You are CLIDE's profile interviewer: a warm, curious colleague, not a form.",
    subjectLine(ctx),
    'Respond ONLY with a single JSON object: { "question": string } to ask the next question, or { "done": true } to end the session.',
    "Rules:",
    "- One question at a time, conversational, plain language. No multi-part questions.",
    `- ${MIN_QUESTIONS_BEFORE_DONE}-${MAX_INTERVIEW_QUESTIONS} questions per session; end early once further questions won't earn much.`,
    '- When an existing profile has content, ask delta questions ("Last time you said X — still true?") instead of restarting.',
    "- Never re-ask what the existing profile or the app profile already answers.",
    ctx.scope === "project" && !ctx.appProfileBlock
      ? "- No app profile exists yet, so ask ONE compressed who-are-you question early, then focus on the project."
      : null,
    "- Skipped answers mean the user doesn't want that topic — move on, don't rephrase the same question.",
    "- Use your notes from previous sessions to avoid questions that historically earned nothing.",
    transcript.length >= MIN_QUESTIONS_BEFORE_DONE
      ? '- You have asked enough questions to end; return { "done": true } unless one more question clearly earns something.'
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await complete(service, { system, user: commonContext(ctx, transcript) });
  const parsed = extractJson(raw);
  if (isObject(parsed) && typeof parsed.question === "string" && parsed.question.trim()) {
    return { question: parsed.question.trim() };
  }
  return { question: null };
}

/** Draft the full section set from the transcript, merged over the existing profile. */
export async function draftProfileSections(
  service: AIService,
  ctx: InterviewContext,
  transcript: InterviewTurn[],
): Promise<ProfileSection[]> {
  const specs = specsFor(ctx.scope);
  const system = [
    "You distill a profile from an interview transcript.",
    subjectLine(ctx),
    "Respond ONLY with a single JSON object mapping section id to value:",
    '- prose sections: a string (short markdown, 1-3 sentences)',
    "- list sections: an array of short strings",
    "Rules:",
    "- Base every value on the transcript and the existing profile only. Never invent.",
    "- Merge: keep existing content the transcript didn't contradict; update what it did.",
    "- Omit a section entirely when you have nothing for it.",
    "- Write about the user in second person ('You are…') — the user reviews and edits this text.",
  ].join("\n");

  const raw = await complete(service, { system, user: commonContext(ctx, transcript) });
  const parsed = extractJson(raw);
  const m = isObject(parsed) ? parsed : {};

  return specs.map((spec) => {
    const existing = ctx.existing.find((s) => s.id === spec.id)?.value ?? (spec.kind === "list" ? [] : "");
    const drafted = m[spec.id];
    let value: string | string[] | null = null;
    if (spec.kind === "list") {
      if (Array.isArray(drafted)) value = drafted.filter((v): v is string => typeof v === "string" && v.trim() !== "");
      else if (typeof drafted === "string" && drafted.trim()) value = [drafted.trim()];
    } else if (typeof drafted === "string" && drafted.trim()) {
      value = drafted.trim();
    }
    return { id: spec.id, label: spec.label, kind: spec.kind, value: value ?? existing };
  });
}

/**
 * Post-session self-critique (§4): which questions earned nothing, what to ask
 * differently next time. Returns the updated (capped) selfNotes to store.
 */
export async function critiqueInterviewSession(
  service: AIService,
  ctx: InterviewContext,
  transcript: InterviewTurn[],
): Promise<string> {
  const system = [
    "You just conducted the interview below. Critique your own questions.",
    'Respond ONLY with a single JSON object: { "notes": string }.',
    "notes = 2-4 terse bullet lines for your future self: which questions earned nothing,",
    "which earned the most, and what to ask differently next time. No praise, no filler.",
  ].join("\n");

  const raw = await complete(service, { system, user: commonContext(ctx, transcript) });
  const parsed = extractJson(raw);
  const notes = isObject(parsed) && typeof parsed.notes === "string" ? parsed.notes.trim() : "";
  if (!notes) return ctx.selfNotes;
  const dated = `[session ${new Date().toISOString().slice(0, 10)}]\n${notes}`;
  return capSelfNotes(ctx.selfNotes ? `${ctx.selfNotes}\n${dated}` : dated);
}

function validateAmendments(
  raw: unknown,
  specs: ProfileSectionSpec[],
  current: ProfileSection[],
): ProfileAmendment[] {
  if (!Array.isArray(raw)) return [];
  const out: ProfileAmendment[] = [];
  for (const item of raw) {
    if (!isObject(item)) continue;
    const spec = specs.find((s) => s.id === item.section);
    if (!spec) continue;
    const cur = current.find((s) => s.id === spec.id)?.value ?? (spec.kind === "list" ? [] : "");
    let proposed: string | string[] | null = null;
    if (spec.kind === "list") {
      if (Array.isArray(item.proposed))
        proposed = item.proposed.filter((v): v is string => typeof v === "string" && v.trim() !== "");
      else if (typeof item.proposed === "string" && item.proposed.trim()) proposed = [item.proposed.trim()];
    } else if (typeof item.proposed === "string" && item.proposed.trim()) {
      proposed = item.proposed.trim();
    }
    if (proposed === null) continue;
    if (JSON.stringify(proposed) === JSON.stringify(cur)) continue; // no-op suggestion
    out.push({
      sectionId: spec.id,
      label: spec.label,
      kind: spec.kind,
      current: cur,
      proposed,
      reason: typeof item.reason === "string" ? item.reason.trim() : "",
    });
  }
  return out;
}

/**
 * Reflection pass (§4, "Refresh from my activity"): recent usage → proposed
 * profile amendments, always a reviewed diff. For project scope the model may
 * additionally surface app-profile suggestions (ticket 101 §4) — one direction
 * only; app reflections never touch project profiles.
 */
export async function reflectOnActivity(
  service: AIService,
  ctx: InterviewContext,
  activity: string,
): Promise<{ amendments: ProfileAmendment[]; appAmendments: ProfileAmendment[] }> {
  const specs = specsFor(ctx.scope);
  const crossScope = ctx.scope === "project" && ctx.appSections !== undefined;
  const system = [
    "You propose profile amendments from observed usage of CLIDE, a task automation app.",
    subjectLine(ctx),
    "Respond ONLY with a single JSON object:",
    `{ "amendments": [{ "section": string, "proposed": string | string[], "reason": string }]${
      crossScope ? ', "appAmendments": [same shape, against the APP profile sections]' : ""
    } }`,
    "Rules:",
    "- Propose only what the activity clearly supports; an empty amendments array is a fine answer.",
    "- 'proposed' is the section's complete new value (prose string, or full list for list sections).",
    "- 'reason' is one short sentence pointing at the evidence.",
    "- Never re-propose anything your notes record as previously rejected.",
    crossScope
      ? '- appAmendments: only for patterns about the user in general (e.g. a recurring theme across projects); app section ids: ' +
        APP_PROFILE_SECTIONS.map((s) => s.id).join(", ")
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const user = [
    `Profile sections:\n${sectionCatalog(specs)}`,
    `Current profile:\n${renderSections(ctx.existing)}`,
    crossScope ? `Current APP profile:\n${renderSections(ctx.appSections!)}` : null,
    ctx.selfNotes ? `Your notes (including rejected suggestions):\n${ctx.selfNotes}` : null,
    `Recent activity:\n${activity}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const raw = await complete(service, { system, user });
  const parsed = extractJson(raw);
  const obj = isObject(parsed) ? parsed : {};
  return {
    amendments: validateAmendments(obj.amendments, specs, ctx.existing),
    appAmendments: crossScope
      ? validateAmendments(obj.appAmendments, APP_PROFILE_SECTIONS, ctx.appSections!)
      : [],
  };
}
