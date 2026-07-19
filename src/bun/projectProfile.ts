import { rmSync } from "node:fs";
import { join } from "node:path";
import { capSelfNotes } from "../shared/profile";
import type { ProjectProfile } from "../shared/types";

/**
 * Project-scoped profile (ticket 101). Lives in the project folder itself —
 * it travels with the folder like forms/, history.db and .views.json, and a
 * registered folder that already contains one adopts it as-is.
 */
export function projectProfilePath(projectPath: string): string {
  return join(projectPath, "profile.json");
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** User-visible file, may be hand-edited or deleted — corrupt/missing → null ("no profile"). */
export async function readProjectProfile(projectPath: string): Promise<ProjectProfile | null> {
  try {
    const file = Bun.file(projectProfilePath(projectPath));
    if (!(await file.exists())) return null;
    const raw = JSON.parse(await file.text()) as Record<string, unknown>;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    return {
      purpose: str(raw.purpose),
      userRole: str(raw.userRole),
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

export async function writeProjectProfile(projectPath: string, profile: ProjectProfile): Promise<void> {
  await Bun.write(projectProfilePath(projectPath), JSON.stringify(profile, null, 2));
}

export function deleteProjectProfile(projectPath: string): void {
  rmSync(projectProfilePath(projectPath), { force: true });
}

/** Append one dated note to the project profile's selfNotes. No-op without a profile. */
export async function appendProjectSelfNote(projectPath: string, note: string): Promise<void> {
  const profile = await readProjectProfile(projectPath);
  if (!profile) return;
  const dated = `- [${new Date().toISOString().slice(0, 10)}] ${note.trim()}`;
  await writeProjectProfile(projectPath, {
    ...profile,
    selfNotes: capSelfNotes(profile.selfNotes ? `${profile.selfNotes}\n${dated}` : dated),
  });
}
