import { join } from "node:path";
import type { UIState } from "../shared/types";
import { appDataDir, ensureDir } from "./paths";

const EMPTY: UIState = { activeProject: null, activeViewByProject: {}, recentProjects: [] };

function uiStatePath(): string {
  return join(appDataDir(), "uiState.json");
}

/** Read persisted UI state. Missing/corrupt file → empty state. */
export async function readUIState(): Promise<UIState> {
  try {
    const file = Bun.file(uiStatePath());
    if (!(await file.exists())) return { ...EMPTY };
    const parsed = JSON.parse(await file.text()) as Partial<UIState>;
    return {
      activeProject: typeof parsed.activeProject === "string" ? parsed.activeProject : null,
      activeViewByProject:
        parsed.activeViewByProject && typeof parsed.activeViewByProject === "object"
          ? Object.fromEntries(Object.entries(parsed.activeViewByProject).filter(([, v]) => typeof v === "string"))
          : {},
      recentProjects: Array.isArray(parsed.recentProjects)
        ? parsed.recentProjects.filter((p): p is string => typeof p === "string")
        : [],
      compactMode: parsed.compactMode === true,
      calendarView: (["day", "week", "month", "agenda"] as const).includes(parsed.calendarView as never)
        ? parsed.calendarView
        : "month",
      speechVoiceURI: typeof parsed.speechVoiceURI === "string" ? parsed.speechVoiceURI : undefined,
      speechActivationKey: (["l", "m", "space", "grave"] as const).includes(parsed.speechActivationKey as never)
        ? parsed.speechActivationKey
        : "l",
      companionEnabled: parsed.companionEnabled !== false,
      companionMuted: parsed.companionMuted === true,
      companionPosition:
        parsed.companionPosition &&
        typeof parsed.companionPosition === "object" &&
        typeof parsed.companionPosition.x === "number" &&
        typeof parsed.companionPosition.y === "number"
          ? { x: parsed.companionPosition.x, y: parsed.companionPosition.y }
          : undefined,
    };
  } catch {
    return { ...EMPTY };
  }
}

export async function writeUIState(state: UIState): Promise<void> {
  ensureDir(appDataDir());
  await Bun.write(uiStatePath(), JSON.stringify(state, null, 2));
}
