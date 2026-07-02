import type { FormFolder, OutputType } from "../../shared/types";

/**
 * In-app event bus (Bun main process). Runs that finish successfully emit
 * their form's declared events; forms listening for those events are
 * auto-submitted through the normal run pipeline. In-memory only — app
 * restart is a clean slate.
 */

/** A fired event travelling the in-app bus. */
export interface BusEvent {
  name: string; // e.g. "media:created"
  sourceRunId: string;
  sourceFormSlug: string;
  /** stdout of the emitting run, plus parsed JSON when its primary output kind is json. */
  payload: { text: string; json?: unknown };
  timestamp: number;
}

/** A form registered as a listener for some event. */
export interface ListenerTarget {
  slug: string;
  projectPath: string;
  projectName: string;
}

/** Auto-submitted runs at or beyond this hop depth emit no further events. */
const MAX_HOPS = 3;

/** event name -> forms listening for it. Rebuilt whenever forms change. */
const listenerIndex = new Map<string, ListenerTarget[]>();

/** runId -> hop depth (0 = user/scheduler initiated). In-memory only. */
const hops = new Map<string, number>();

type AutoSubmitHandler = (event: BusEvent, target: ListenerTarget) => void;
let autoSubmit: AutoSubmitHandler | null = null;

/** Register the single handler that submits listener forms (wired in index.ts). */
export function setAutoSubmitHandler(handler: AutoSubmitHandler): void {
  autoSubmit = handler;
}

/** (Re)build the event → listeners index from the currently loaded forms. */
export function rebuildListenerIndex(forms: FormFolder[]): void {
  listenerIndex.clear();
  for (const folder of forms) {
    for (const name of folder.form.events?.listensFor ?? []) {
      const list = listenerIndex.get(name) ?? [];
      list.push({
        slug: folder.meta.slug,
        projectPath: folder.projectPath,
        projectName: folder.meta.project,
      });
      listenerIndex.set(name, list);
    }
  }
}

/** Record the hop depth of an auto-submitted run (source depth + 1). */
export function registerHop(newRunId: string, sourceRunId: string): void {
  hops.set(newRunId, (hops.get(sourceRunId) ?? 0) + 1);
}

/**
 * Publish a successful run's declared events. Applies the cycle guard: runs at
 * hop ≥ MAX_HOPS trigger nothing, and direct self-loops are refused.
 */
export function publishRunEvents(
  source: { runId: string; formSlug: string },
  emits: string[],
  payloadText: string,
  primaryKind: OutputType,
): void {
  if (!autoSubmit || emits.length === 0) return;

  const hop = hops.get(source.runId) ?? 0;
  if (hop >= MAX_HOPS) {
    console.warn(`[bus] Run ${source.runId} (${source.formSlug}) at hop ${hop} — events suppressed (cycle guard).`);
    return;
  }

  let json: unknown;
  if (primaryKind === "json") {
    try {
      json = JSON.parse(payloadText);
    } catch {
      json = undefined;
    }
  }

  for (const name of emits) {
    const targets = listenerIndex.get(name) ?? [];
    if (targets.length === 0) continue;
    const event: BusEvent = {
      name,
      sourceRunId: source.runId,
      sourceFormSlug: source.formSlug,
      payload: { text: payloadText, json },
      timestamp: Date.now(),
    };
    for (const target of targets) {
      if (target.slug === source.formSlug) {
        console.warn(`[bus] Refusing self-loop: ${source.formSlug} listens for its own event "${name}".`);
        continue;
      }
      autoSubmit(event, target);
    }
  }
}
