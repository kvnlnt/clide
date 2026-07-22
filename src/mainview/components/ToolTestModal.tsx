import { ChevronDown, ChevronRight, Square, Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, on } from "../rpc";
import type { ToolRegistryEntry } from "../types/tasks";
import Modal from "./Modal";
import { useUIFeedback } from "./UIFeedback";

interface ReplEntry {
  runId: string;
  command: string;
  output: { type: "stdout" | "stderr"; data: string }[];
  status: "running" | "success" | "error";
  exitCode: number | null;
}

const inputBase =
  "rounded-md border border-clide-border bg-clide-bg px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30";

/**
 * Ticket 136 — guided run + REPL for a registered tool: an argument field
 * feeds runs that stream into a terminal-styled scrollback, with the tool's
 * captured docs alongside so the user tests with the spec in view. The
 * command line (executable + args) is visible before Run is ever clicked,
 * which is the "show what will run" consent step here — the same posture
 * ticket 53's help-capture confirm uses, just surfaced inline instead of a
 * second popup, so successive runs can scroll like a real REPL session.
 */
export default function ToolTestModal({ tool, onClose }: { tool: ToolRegistryEntry; onClose: () => void }) {
  const [argsInput, setArgsInput] = useState("");
  const [entries, setEntries] = useState<ReplEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [docsOpen, setDocsOpen] = useState(true);
  const runningRunIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useUIFeedback();

  useEffect(() => {
    const unsubChunk = on("chunk", (chunk) => {
      if (typeof chunk.runId !== "string" || !chunk.runId.startsWith("tooltest:")) return;
      setEntries((prev) =>
        prev.map((e) =>
          e.runId === chunk.runId
            ? { ...e, output: [...e.output, { type: chunk.type as "stdout" | "stderr", data: chunk.data }] }
            : e,
        ),
      );
    });
    const unsubStatus = on("status", (update) => {
      if (typeof update.runId !== "string" || !update.runId.startsWith("tooltest:")) return;
      if (update.status === "running") return; // entry already created running by handleRun
      if (runningRunIdRef.current === update.runId) {
        runningRunIdRef.current = null;
        setRunning(false);
      }
      setEntries((prev) =>
        prev.map((e) =>
          e.runId === update.runId
            ? { ...e, status: update.status === "success" ? "success" : "error", exitCode: update.exitCode }
            : e,
        ),
      );
    });
    return () => {
      unsubChunk();
      unsubStatus();
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [entries]);

  // A running invocation is cancelled on close (ticket 136) — Escape, backdrop, or the Close button all route here.
  const handleClose = () => {
    if (runningRunIdRef.current) void api.cancelToolTest(runningRunIdRef.current);
    onClose();
  };

  const handleRun = async () => {
    if (running) return;
    const command = argsInput.trim();
    setRunning(true);
    const res = await api.runToolTest(tool.execPath, command);
    if (!res.ok || !res.runId) {
      setRunning(false);
      toast(res.error || "Could not start the tool", "error");
      return;
    }
    runningRunIdRef.current = res.runId;
    setEntries((prev) => [
      ...prev,
      {
        runId: res.runId!,
        command: command ? `${tool.execPath} ${command}` : tool.execPath,
        output: [],
        status: "running",
        exitCode: null,
      },
    ]);
  };

  const handleStop = () => {
    if (runningRunIdRef.current) void api.cancelToolTest(runningRunIdRef.current);
  };

  return (
    <Modal
      onClose={handleClose}
      widthClassName="w-[900px]"
      panelClassName="flex max-h-[85%] flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-clide-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Terminal size={15} className="text-white/40" />
          <span className="text-[14px] font-bold text-white">Test — {tool.name}</span>
        </div>
        <button onClick={handleClose} className="rounded-md px-3 py-1.5 text-[13px] text-white/50 hover:bg-white/5">
          Close
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* REPL */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-clide-border px-4 py-2.5">
            <span className="shrink-0 truncate font-mono text-[12px] text-white/50" title={tool.execPath}>
              {tool.execPath}
            </span>
            <input
              autoFocus
              className={`${inputBase} min-w-0 flex-1 font-mono`}
              placeholder="arguments…"
              value={argsInput}
              onChange={(e) => setArgsInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleRun();
              }}
            />
            {running ? (
              <button
                onClick={handleStop}
                className="flex shrink-0 items-center gap-1.5 rounded-md bg-red-500/20 px-3 py-1.5 text-[12px] font-medium text-red-300 hover:bg-red-500/30"
              >
                <Square size={11} /> Stop
              </button>
            ) : (
              <button
                onClick={() => void handleRun()}
                className="shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/20"
              >
                Run
              </button>
            )}
          </div>

          <div ref={scrollRef} className="clide-scroll flex-1 overflow-auto p-4 font-mono text-[12.5px]">
            {entries.length === 0 ? (
              <div className="italic text-white/30">Enter arguments above and Run — output streams here.</div>
            ) : (
              <div className="flex flex-col gap-4">
                {entries.map((entry) => (
                  <div key={entry.runId}>
                    <div className="flex items-center gap-2 text-white/50">
                      <span className="text-white/30">$</span>
                      <span className="truncate">{entry.command}</span>
                      {entry.status === "running" && <span className="shrink-0 text-white/30">running…</span>}
                      {entry.status !== "running" && (
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${
                            entry.exitCode === 0
                              ? "bg-emerald-400/15 text-emerald-300"
                              : "bg-red-400/15 text-red-300"
                          }`}
                        >
                          exit {entry.exitCode ?? "?"}
                        </span>
                      )}
                    </div>
                    <pre className="mt-1 whitespace-pre-wrap break-all">
                      {entry.output.length === 0 && entry.status === "running" ? (
                        <span className="text-white/30">…</span>
                      ) : (
                        entry.output.map((chunk, i) => (
                          <span key={i} className={chunk.type === "stderr" ? "text-red-300/80" : "text-white/80"}>
                            {chunk.data}
                          </span>
                        ))
                      )}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Docs pane */}
        <div className="flex w-72 shrink-0 flex-col border-l border-clide-border">
          <button
            onClick={() => setDocsOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-bold uppercase tracking-wider text-white/40 hover:text-white/60"
          >
            {docsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            Docs
          </button>
          {docsOpen && (
            <div className="clide-scroll flex-1 overflow-auto px-3 pb-3">
              {tool.spec ? (
                <div className="flex flex-col gap-3 text-[12.5px] text-white/70">
                  {tool.spec.description && <p className="text-white/60">{tool.spec.description}</p>}
                  {tool.spec.subcommands.length > 0 && (
                    <div>
                      <div className="mb-1 text-[11px] font-medium uppercase text-white/30">Subcommands</div>
                      {tool.spec.subcommands.map((s) => (
                        <div key={s.name} className="flex flex-col">
                          <span className="font-mono text-white/80">{s.name}</span>
                          <span className="text-white/40">{s.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {tool.spec.options.length > 0 && (
                    <div>
                      <div className="mb-1 text-[11px] font-medium uppercase text-white/30">Options</div>
                      {tool.spec.options.map((o) => (
                        <div key={o.flags.join(",")} className="flex flex-col">
                          <span className="font-mono text-white/80">{o.flags.join(", ")}</span>
                          <span className="text-white/40">{o.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {tool.spec.positionals.length > 0 && (
                    <div>
                      <div className="mb-1 text-[11px] font-medium uppercase text-white/30">Positionals</div>
                      {tool.spec.positionals.map((p) => (
                        <div key={p.name} className="flex flex-col">
                          <span className="font-mono text-white/80">{p.name}</span>
                          <span className="text-white/40">{p.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {tool.spec.examples.length > 0 && (
                    <div>
                      <div className="mb-1 text-[11px] font-medium uppercase text-white/30">Examples</div>
                      {tool.spec.examples.map((ex, i) => (
                        <div key={i} className="font-mono text-white/60">
                          {ex}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : tool.helpText ? (
                <pre className="whitespace-pre-wrap font-mono text-[11px] text-white/60">{tool.helpText}</pre>
              ) : (
                <div className="text-[12px] italic text-white/30">No captured documentation for this tool yet.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
