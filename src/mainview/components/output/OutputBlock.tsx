import { useEffect, useMemo, useState } from "react";
import { copyToClipboard } from "../../clipboard";
import { api } from "../../rpc";
import type { OutputChunk, OutputResult, OutputType, RunStatus } from "../../types/tasks";
import AudioOutput from "./AudioOutput";
import AutoSizeOutput from "./AutoSizeOutput";
import ImageOutput from "./ImageOutput";
import JsonOutput from "./JsonOutput";
import OutputToolbar from "./OutputToolbar";
import TableOutput, { tableRowCount } from "./TableOutput";
import TextOutput from "./TextOutput";
import VideoOutput from "./VideoOutput";

export interface OutputBlockProps {
  runId: string;
  outputType: OutputType;
  status: RunStatus;
  chunks: OutputChunk[];
}

function decodeBase64ToText(base64: string): string {
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

/** One labeled block per evaluated output definition (ticket 87): value rendered by kind, failures visible. */
function NamedOutputBlock({ result }: { result: OutputResult }) {
  const text = typeof result.value === "string" ? result.value : JSON.stringify(result.value, null, 2);
  return (
    <div className="overflow-hidden rounded-[5px] border border-clide-border bg-clide-bg">
      <OutputToolbar
        label={`${result.name} · ${result.kind}`}
        onCopy={result.ok ? () => void copyToClipboard(text) : undefined}
      />
      {!result.ok ? (
        <div className="px-3 py-2 text-[13px] text-amber-300/80">{result.error}</div>
      ) : result.kind === "table" ? (
        <TableOutput text={text} />
      ) : result.kind === "json" ? (
        <JsonOutput text={text} />
      ) : result.kind === "image" || result.kind === "audio" || result.kind === "video" ? (
        // Named media values are file paths — shown as the path (the raw block handles inline media).
        <div className="break-all px-3 py-2 font-mono text-[12px] text-white/70">{text}</div>
      ) : (
        <AutoSizeOutput className="px-3 py-2 font-mono text-[13px]">
          <pre className="whitespace-pre-wrap break-words text-white/80">{text}</pre>
        </AutoSizeOutput>
      )}
    </div>
  );
}

export default function OutputBlock({ runId, outputType, status, chunks }: OutputBlockProps) {
  const [fetchedText, setFetchedText] = useState<string | null>(null);
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);
  const [namedOutputs, setNamedOutputs] = useState<OutputResult[]>([]);

  const liveStdout = useMemo(
    () =>
      chunks
        .filter((c) => c.type === "stdout")
        .map((c) => c.data)
        .join(""),
    [chunks],
  );
  const liveStderr = useMemo(
    () =>
      chunks
        .filter((c) => c.type === "stderr")
        .map((c) => c.data)
        .join(""),
    [chunks],
  );

  const completed = status === "success" || status === "error";
  const isMedia = outputType === "image" || outputType === "audio" || outputType === "video";

  // Load captured output for media outputs, and for text-like outputs when no
  // live chunks are present (e.g. re-opening a historical run).
  useEffect(() => {
    let cancelled = false;
    if (!completed) return;
    const needsText = !isMedia && liveStdout.length === 0;
    const needsMedia = isMedia && mediaSrc === null;
    if (!needsText && !needsMedia) return;

    void api.readOutputFile(runId).then((res) => {
      if (cancelled || !res) return;
      if (isMedia) {
        setMediaSrc(`data:${res.mime};base64,${res.base64}`);
      } else {
        setFetchedText(decodeBase64ToText(res.base64));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [completed, isMedia, liveStdout.length, mediaSrc, runId]);

  // Named output definitions evaluated for this run (ticket 86/87).
  useEffect(() => {
    if (!completed) return;
    let cancelled = false;
    void api.getRunOutputs(runId).then((results) => {
      if (!cancelled) setNamedOutputs(results);
    });
    return () => {
      cancelled = true;
    };
  }, [completed, runId]);

  const text = liveStdout || fetchedText || "";
  const streaming = status === "running" || status === "pending";

  let label = outputType.toUpperCase();
  if (outputType === "table" && text) {
    label = `${tableRowCount(text)} rows`;
  }
  if (streaming) label = "STREAMING";

  const copyText = () => {
    if (text) void copyToClipboard(text);
  };

  let body: React.ReactNode;
  switch (outputType) {
    case "table":
      body = <TableOutput text={text} />;
      break;
    case "json":
      body = <JsonOutput text={text} />;
      break;
    case "image":
      body = <ImageOutput src={mediaSrc} />;
      break;
    case "audio":
      body = <AudioOutput src={mediaSrc} />;
      break;
    case "video":
      body = <VideoOutput src={mediaSrc} />;
      break;
    default:
      body = <TextOutput stdout={text} stderr={liveStderr} />;
  }

  // Migrated-legacy definitions (id "legacy-*") mirror the raw block exactly —
  // rendering them twice would be noise; user-defined outputs all render.
  const definedOutputs = namedOutputs.filter((o) => !o.id.startsWith("legacy-"));

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-[5px] border border-clide-border bg-clide-bg">
        <OutputToolbar label={label} onCopy={isMedia ? undefined : copyText} />
        {body}
      </div>
      {definedOutputs.map((result) => (
        <NamedOutputBlock key={result.id} result={result} />
      ))}
    </div>
  );
}
