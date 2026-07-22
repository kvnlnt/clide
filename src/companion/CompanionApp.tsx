import { Mic, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { CompanionTranscriptLine } from "../shared/types";
import { api, on } from "./rpc";

const COMPACT_SIZE = { width: 220, height: 220 };
const EXPANDED_SIZE = { width: 300, height: 440 };
const BAR_COUNT = 5;

type FaceState = "idle" | "listening" | "speaking";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

/**
 * Procedural waveform (ticket 138): WebKit exposes no audio buffer for real
 * amplitude analysis, so bar heights are driven by design, not sampling —
 * randomized per speechSynthesis `boundary` event (roughly one per spoken
 * word), smoothed by a CSS transition so it reads as motion, not jitter.
 */
function Waveform({ state, muted }: { state: FaceState; muted: boolean }) {
  const [heights, setHeights] = useState<number[]>(() => Array(BAR_COUNT).fill(0.3));
  const tickRef = useRef(0);

  useEffect(() => {
    if (state !== "speaking") return;
    const id = setInterval(() => {
      tickRef.current += 1;
      setHeights((prev) => prev.map((_, i) => 0.25 + Math.abs(Math.sin(tickRef.current * 1.7 + i * 1.3)) * 0.75));
    }, 220);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    if (state !== "speaking") setHeights(Array(BAR_COUNT).fill(state === "listening" ? 0.5 : 0.3));
  }, [state]);

  return (
    <div className={`companion-waveform companion-waveform--${state}${muted ? " companion-waveform--muted" : ""}`}>
      {heights.map((h, i) => (
        <span key={i} className="companion-bar" style={{ "--bar-scale": h } as CSSProperties} />
      ))}
    </div>
  );
}

export default function CompanionApp() {
  const [muted, setMuted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [faceState, setFaceState] = useState<FaceState>("idle");
  const [pulse, setPulse] = useState(false);
  const [transcript, setTranscript] = useState<CompanionTranscriptLine[]>([]);
  const speakingRef = useRef(false);
  /** Mirrors `muted` for the mount-only push-event subscription below. */
  const mutedRef = useRef(false);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    void api.companionReady().then((res) => setMuted(res.muted));
  }, []);

  useEffect(() => {
    const offPhase = on("speechPhase", (event) => {
      if (event.phase === "start") {
        speakingRef.current = true;
        setFaceState("speaking");
      } else if (event.phase === "end") {
        speakingRef.current = false;
        setFaceState((s) => (s === "speaking" ? "idle" : s));
      }
    });
    const offListening = on("listening", (listening) => {
      setFaceState(listening ? "listening" : speakingRef.current ? "speaking" : "idle");
    });
    const offTranscript = on("transcriptLine", (line) => {
      setTranscript((prev) => [...prev.slice(-49), line]);
      // Muted talk-back has no audio cue, so the face pulses to draw the eye
      // to the new transcript line instead (ticket 138).
      if (mutedRef.current) {
        setPulse(true);
        setTimeout(() => setPulse(false), 900);
      }
    });
    return () => {
      offPhase();
      offListening();
      offTranscript();
    };
  }, []);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    const size = next ? EXPANDED_SIZE : COMPACT_SIZE;
    void api.resizeCompanion(size.width, size.height);
  };

  const toggleMuted = () => {
    const next = !muted;
    setMuted(next);
    void api.setCompanionMuted(next);
  };

  const title = useMemo(() => {
    if (faceState === "listening") return "Listening…";
    if (faceState === "speaking") return muted ? "CLIDE (muted) — see transcript" : "CLIDE is speaking";
    return "CLIDE — click to expand";
  }, [faceState, muted]);

  return (
    <div className={`companion-root${expanded ? " companion-root--expanded" : ""}`}>
      <div className="companion-card">
        {expanded && (
          <div className="companion-header electrobun-webkit-app-region-drag">
            <span className="companion-title">CLIDE</span>
            <div className="companion-header-actions electrobun-webkit-app-region-no-drag">
              <button
                type="button"
                onClick={toggleMuted}
                title={muted ? "Unmute talk-back" : "Mute talk-back (still shown as text)"}
                className="companion-icon-btn"
              >
                {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
              <button
                type="button"
                onClick={() => void api.hideCompanion()}
                title="Hide companion"
                className="companion-icon-btn"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={toggleExpanded}
          title={title}
          className={`companion-face electrobun-webkit-app-region-drag${pulse ? " companion-face--pulse" : ""}`}
        >
          <div className={`companion-orb companion-orb--${faceState}`}>
            <Waveform state={faceState} muted={muted} />
          </div>
          {faceState === "listening" && (
            <Mic size={12} className="companion-mic-badge" />
          )}
        </button>

        {expanded && (
          <div className="companion-transcript electrobun-webkit-app-region-no-drag">
            {transcript.length === 0 ? (
              <div className="companion-transcript-empty">Nothing said yet.</div>
            ) : (
              transcript.map((line) => (
                <div key={line.id} className={`companion-line companion-line--${line.role}`}>
                  <span className="companion-line-text">{line.text}</span>
                  <span className="companion-line-time">{formatTime(line.timestamp)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
