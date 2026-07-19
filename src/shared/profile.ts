import type { ProfileSection, ProjectProfile, UserProfile } from "./types";

// Profile section specs (tickets 100/101) — the schema the interview engine
// runs against. The question set is data (selfNotes), but the section shape
// is fixed here so both scopes flow through one engine and one review UI.

export interface ProfileSectionSpec {
  id: string;
  label: string;
  kind: "text" | "list";
  /** What the section captures — steers the interview's question generation. */
  hint: string;
}

export const APP_PROFILE_SECTIONS: ProfileSectionSpec[] = [
  {
    id: "identity",
    label: "Identity",
    kind: "text",
    hint: "who the user is — background, context, how they describe themselves",
  },
  { id: "roles", label: "Roles", kind: "text", hint: "the roles they hold — job titles, hats they wear" },
  {
    id: "responsibilities",
    label: "Responsibilities",
    kind: "text",
    hint: "what they're on the hook for day to day",
  },
  { id: "goals", label: "Goals", kind: "list", hint: "what they're trying to accomplish with this software" },
  {
    id: "frustrations",
    label: "Frustrations",
    kind: "list",
    hint: "what has historically frustrated or slowed them down",
  },
];

export const PROJECT_PROFILE_SECTIONS: ProfileSectionSpec[] = [
  { id: "purpose", label: "Purpose", kind: "text", hint: "what this project is for" },
  { id: "userRole", label: "Your role", kind: "text", hint: "the user's role within this project specifically" },
  {
    id: "responsibilities",
    label: "Responsibilities",
    kind: "text",
    hint: "what the user is responsible for within this project",
  },
  { id: "goals", label: "Goals", kind: "list", hint: "what success / 'done' looks like for this project" },
  {
    id: "frustrations",
    label: "Frustrations",
    kind: "list",
    hint: "what kept going wrong before — the pain this project exists to relieve",
  },
];

function valueFor(spec: ProfileSectionSpec, source: Record<string, unknown> | null): string | string[] {
  const raw = source?.[spec.id];
  if (spec.kind === "list") {
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
  }
  return typeof raw === "string" ? raw : "";
}

function toSections(specs: ProfileSectionSpec[], source: Record<string, unknown> | null): ProfileSection[] {
  return specs.map((spec) => ({ id: spec.id, label: spec.label, kind: spec.kind, value: valueFor(spec, source) }));
}

export function userProfileToSections(profile: UserProfile | null): ProfileSection[] {
  return toSections(APP_PROFILE_SECTIONS, profile as Record<string, unknown> | null);
}

export function projectProfileToSections(profile: ProjectProfile | null): ProfileSection[] {
  return toSections(PROJECT_PROFILE_SECTIONS, profile as Record<string, unknown> | null);
}

function sectionMap(sections: ProfileSection[]): Record<string, string | string[]> {
  return Object.fromEntries(sections.map((s) => [s.id, s.value]));
}

function text(v: string | string[] | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

function list(v: string | string[] | undefined): string[] {
  return Array.isArray(v) ? v.map((x) => x.trim()).filter(Boolean) : [];
}

export interface SectionsToProfileOptions {
  /** True when the save concludes an interview session — bumps interviewCount. */
  interviewed?: boolean;
  /** Replacement selfNotes (post-session critique); previous notes kept when omitted. */
  selfNotes?: string;
}

export function sectionsToUserProfile(
  sections: ProfileSection[],
  prev: UserProfile | null,
  opts: SectionsToProfileOptions = {},
): UserProfile {
  const m = sectionMap(sections);
  return {
    identity: text(m.identity),
    roles: text(m.roles),
    responsibilities: text(m.responsibilities),
    goals: list(m.goals),
    frustrations: list(m.frustrations),
    updatedAt: new Date().toISOString(),
    interviewCount: (prev?.interviewCount ?? 0) + (opts.interviewed ? 1 : 0),
    selfNotes: opts.selfNotes ?? prev?.selfNotes ?? "",
  };
}

export function sectionsToProjectProfile(
  sections: ProfileSection[],
  prev: ProjectProfile | null,
  opts: SectionsToProfileOptions = {},
): ProjectProfile {
  const m = sectionMap(sections);
  return {
    purpose: text(m.purpose),
    userRole: text(m.userRole),
    responsibilities: text(m.responsibilities),
    goals: list(m.goals),
    frustrations: list(m.frustrations),
    updatedAt: new Date().toISOString(),
    interviewCount: (prev?.interviewCount ?? 0) + (opts.interviewed ? 1 : 0),
    selfNotes: opts.selfNotes ?? prev?.selfNotes ?? "",
  };
}

/** True when every section is blank — an all-skipped interview must not save an empty shell. */
export function isProfileContentEmpty(sections: ProfileSection[]): boolean {
  return sections.every((s) => (Array.isArray(s.value) ? s.value.every((v) => !v.trim()) : !s.value.trim()));
}

const SELF_NOTES_CAP = 4000;

/** Keep selfNotes bounded — oldest notes fall off the front. */
export function capSelfNotes(notes: string): string {
  const trimmed = notes.trim();
  return trimmed.length <= SELF_NOTES_CAP ? trimmed : trimmed.slice(trimmed.length - SELF_NOTES_CAP);
}
