import type { ProjectProfile, UserProfile } from "../../shared/types";
import { readUserProfile } from "../profile";
import { readProjectProfile } from "../projectProfile";

// Profile consumption (tickets 100 §5 / 101 §5): renders the saved profiles
// into a compact system-prompt block. Every call site gets the same capped
// block so the profile can never crowd out the actual task.

/** Per-block character cap; app + project together stay under 2×CAP. */
const BLOCK_CAP = 700;

function cap(text: string): string {
  return text.length <= BLOCK_CAP ? text : `${text.slice(0, BLOCK_CAP - 1)}…`;
}

function line(label: string, value: string | string[]): string | null {
  const rendered = Array.isArray(value) ? value.filter((v) => v.trim()).join("; ") : value.trim();
  return rendered ? `- ${label}: ${rendered}` : null;
}

/** Compact app-profile block, also used as interview context ("already known"). */
export function renderUserProfileBlock(profile: UserProfile): string {
  const lines = [
    line("Identity", profile.identity),
    line("Roles", profile.roles),
    line("Responsibilities", profile.responsibilities),
    line("Goals", profile.goals),
    line("Frustrations", profile.frustrations),
  ].filter(Boolean);
  return lines.length > 0 ? cap(["About the user:", ...lines].join("\n")) : "";
}

function renderProjectProfileBlock(profile: ProjectProfile, projectName?: string): string {
  const lines = [
    line("Purpose", profile.purpose),
    line("User's role here", profile.userRole),
    line("Responsibilities", profile.responsibilities),
    line("Goals", profile.goals),
    line("Frustrations it relieves", profile.frustrations),
  ].filter(Boolean);
  if (lines.length === 0) return "";
  return cap([`About the current project${projectName ? ` ("${projectName}")` : ""}:`, ...lines].join("\n"));
}

/**
 * Standing profile context for AI calls. App block first, project block last
 * (when a projectPath is given) so the project wins on conflict (ticket 101).
 * Empty string when no profile exists — callers append it conditionally.
 */
export async function profileContext(projectPath?: string, projectName?: string): Promise<string> {
  const blocks: string[] = [];
  const app = await readUserProfile();
  if (app) {
    const block = renderUserProfileBlock(app);
    if (block) blocks.push(block);
  }
  if (projectPath) {
    const proj = await readProjectProfile(projectPath);
    if (proj) {
      const block = renderProjectProfileBlock(proj, projectName);
      if (block) blocks.push(block);
    }
  }
  if (blocks.length === 0) return "";
  return ["User profile context (background only — the task at hand always takes priority):", ...blocks].join("\n\n");
}
