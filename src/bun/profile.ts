import { rmSync } from "node:fs";
import { join } from "node:path";
import { capSelfNotes } from "../shared/profile";
import type { UserProfile } from "../shared/types";
import { appDataDir, ensureDir } from "./paths";

/** App-scoped user profile (ticket 100), beside projects.json. */
export function userProfilePath(): string {
  return join(appDataDir(), "profile.json");
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Missing/corrupt file → null ("no profile"), same resilience as .views.json. */
export async function readUserProfile(): Promise<UserProfile | null> {
  try {
    const file = Bun.file(userProfilePath());
    if (!(await file.exists())) return null;
    const raw = JSON.parse(await file.text()) as Record<string, unknown>;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    return {
      identity: str(raw.identity),
      roles: str(raw.roles),
      responsibilities: str(raw.responsibilities),
      goals: strList(raw.goals),
      frustrations: strList(raw.frustrations),
      updatedAt: str(raw.updatedAt),
      interviewCount: typeof raw.interviewCount === "number" ? raw.interviewCount : 0,
      selfNotes: str(raw.selfNotes),
    };
  } catch {
    return null;
  }
}

export async function writeUserProfile(profile: UserProfile): Promise<void> {
  ensureDir(appDataDir());
  await Bun.write(userProfilePath(), JSON.stringify(profile, null, 2));
}

export function deleteUserProfile(): void {
  rmSync(userProfilePath(), { force: true });
}

/** Append one dated note to the profile's selfNotes (e.g. a rejected amendment). No-op without a profile. */
export async function appendUserSelfNote(note: string): Promise<void> {
  const profile = await readUserProfile();
  if (!profile) return;
  const dated = `- [${new Date().toISOString().slice(0, 10)}] ${note.trim()}`;
  await writeUserProfile({
    ...profile,
    selfNotes: capSelfNotes(profile.selfNotes ? `${profile.selfNotes}\n${dated}` : dated),
  });
}
