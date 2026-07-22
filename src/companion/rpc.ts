import { Electroview } from "electrobun/view";
import type { ClideCompanionRPC, CompanionSpeechEvent, CompanionTranscriptLine } from "../shared/types";

// ---------------------------------------------------------------------------
// Event bus for push messages from the Bun main process, relayed from the
// main window's own speech.ts usage (ticket 138 — see src/bun/index.ts).
// ---------------------------------------------------------------------------
type EventMap = {
  speechPhase: CompanionSpeechEvent;
  transcriptLine: CompanionTranscriptLine;
  listening: boolean;
};

type Listener<K extends keyof EventMap> = (payload: EventMap[K]) => void;

const listeners: { [K in keyof EventMap]: Set<Listener<K>> } = {
  speechPhase: new Set(),
  transcriptLine: new Set(),
  listening: new Set(),
};

function emit<K extends keyof EventMap>(key: K, payload: EventMap[K]): void {
  for (const l of listeners[key]) l(payload);
}

export function on<K extends keyof EventMap>(key: K, listener: Listener<K>): () => void {
  listeners[key].add(listener);
  return () => listeners[key].delete(listener);
}

const rpcDef = Electroview.defineRPC<ClideCompanionRPC>({
  maxRequestTime: 10000,
  handlers: {
    requests: {},
    messages: {
      onCompanionSpeechPhase: (event) => emit("speechPhase", event),
      onCompanionTranscriptLine: (line) => emit("transcriptLine", line),
      onCompanionListening: ({ listening }) => emit("listening", listening),
    },
  },
});

let electroview: Electroview<typeof rpcDef> | null = null;
try {
  electroview = new Electroview({ rpc: rpcDef });
} catch (err) {
  console.warn("[companion rpc] Electroview unavailable (running outside Electrobun?)", err);
}

function request(): typeof rpcDef.request | null {
  return electroview?.rpc?.request ?? null;
}

export const api = {
  async companionReady(): Promise<{ muted: boolean }> {
    const r = request();
    if (!r) return { muted: false };
    try {
      return await r.companionReady({});
    } catch {
      return { muted: false };
    }
  },

  async setCompanionMuted(muted: boolean): Promise<void> {
    await request()?.setCompanionMuted({ muted });
  },

  async hideCompanion(): Promise<void> {
    await request()?.hideCompanion(null);
  },

  async resizeCompanion(width: number, height: number): Promise<void> {
    await request()?.resizeCompanion({ width, height });
  },
};
