import { useEffect, useMemo, useState } from "react";
import { api } from "../../rpc";
import type { OutputChunk, OutputType, RunStatus } from "../../types/forms";
import AudioOutput from "./AudioOutput";
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

const DEFAULT_MAX = 400;

function decodeBase64ToText(base64: string): string {
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

export default function OutputBlock({ runId, outputType, status, chunks }: OutputBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [fetchedText, setFetchedText] = useState<string | null>(null);
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);

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

  const text = liveStdout || fetchedText || "";
  const streaming = status === "running" || status === "pending";
  const maxHeight = expanded ? null : DEFAULT_MAX;

  let label = outputType.toUpperCase();
  if (outputType === "table" && text) {
    label = `${tableRowCount(text)} rows`;
  }
  if (streaming) label = "STREAMING";

  const copyText = () => {
    if (text) void navigator.clipboard?.writeText(text);
  };

  let body: React.ReactNode;
  switch (outputType) {
    case "table":
      body = <TableOutput text={text} maxHeight={maxHeight} />;
      break;
    case "json":
      body = <JsonOutput text={text} maxHeight={maxHeight} />;
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
      body = <TextOutput stdout={text} stderr={liveStderr} maxHeight={maxHeight} />;
  }

  return (
    <div className="overflow-hidden rounded-[5px] border border-clide-border bg-clide-surface">
      <OutputToolbar
        label={label}
        expanded={expanded}
        onToggleExpand={() => setExpanded((e) => !e)}
        onCopy={isMedia ? undefined : copyText}
      />
      {body}
    </div>
  );
}
