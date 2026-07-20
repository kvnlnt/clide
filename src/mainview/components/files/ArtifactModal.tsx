/**
 * Artifact preview modal (ticket 102, fixed/restyled ticket 118): shows file
 * previews for run artifacts. Images inline, PDF via iframe, text/JSON in
 * <pre>, others get Open/Reveal. Artifacts carry a self-contained URI (e.g.
 * "local:///Users/…") that isn't tied to any registered VFS location, so
 * preview/open dispatch straight to the provider by URI — no location
 * lookup needed or possible.
 */

import { FileX2, FolderOpen, Loader, SquareArrowOutUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { RunArtifact } from "../../../shared/types";
import { api } from "../../rpc";
import Modal from "../Modal";
import { useUIFeedback } from "../UIFeedback";

interface ArtifactModalProps {
  artifact: RunArtifact;
  onClose: () => void;
}

const MAX_PREVIEW_BYTES = 5 * 1024 * 1024; // 5MB — same spirit as OutputBlock's inline media cap

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ArtifactModal({ artifact, onClose }: ArtifactModalProps) {
  const { toast } = useUIFeedback();
  const [preview, setPreview] = useState<{ dataUrl: string; mime: string; text: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPreview(null);
    setError(null);

    if (artifact.kind === "deleted") {
      setLoading(false);
      return;
    }
    if (artifact.size !== undefined && artifact.size > MAX_PREVIEW_BYTES) {
      setLoading(false);
      return; // Falls through to the Open/Reveal panel — too large to preview inline.
    }

    setLoading(true);
    void api.vfsReadByUri(artifact.uri, MAX_PREVIEW_BYTES).then((res) => {
      setLoading(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      const isText =
        res.mime.startsWith("text/") || res.mime === "application/json" || res.mime === "application/javascript";
      let text: string | null = null;
      if (isText) {
        try {
          text = new TextDecoder().decode(Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0)));
        } catch {
          text = null;
        }
      }
      setPreview({ dataUrl: `data:${res.mime};base64,${res.base64}`, mime: res.mime, text });
    });
  }, [artifact]);

  const handleOpen = async () => {
    const res = await api.vfsOpenByUri(artifact.uri, false);
    if (!res.ok) toast(res.error ?? "Failed to open file", "error");
  };

  const handleReveal = async () => {
    const res = await api.vfsOpenByUri(artifact.uri, true);
    if (!res.ok) toast(res.error ?? "Failed to reveal file", "error");
  };

  const actionButtons = (
    <div className="flex gap-2">
      <button
        onClick={() => void handleOpen()}
        className="flex items-center gap-1.5 rounded-md bg-white/10 px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-white/20"
      >
        <SquareArrowOutUpRight size={13} /> Open
      </button>
      <button
        onClick={() => void handleReveal()}
        className="flex items-center gap-1.5 rounded-md border border-clide-border px-3.5 py-1.5 text-[13px] text-white/70 hover:bg-white/5 hover:text-white"
      >
        <FolderOpen size={13} /> Reveal in Finder
      </button>
    </div>
  );

  const renderPreview = () => {
    if (artifact.kind === "deleted") {
      return (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <FileX2 size={32} className="text-white/25" />
          <div>
            <p className="text-[14px] font-medium text-white/70">File deleted</p>
            <p className="mt-1 text-[12px] text-white/40">{artifact.name}</p>
          </div>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center gap-2 py-14 text-[13px] text-white/40">
          <Loader size={14} className="animate-spin" /> Loading preview…
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <p className="max-w-[360px] text-[13px] text-red-300/80">{error}</p>
          {actionButtons}
        </div>
      );
    }

    if (preview) {
      if (preview.mime.startsWith("image/")) {
        return <img src={preview.dataUrl} alt={artifact.name} className="max-h-[70vh] w-full object-contain" />;
      }
      if (preview.mime === "application/pdf") {
        return <iframe src={preview.dataUrl} title={artifact.name} className="h-[70vh] w-full border-0" />;
      }
      if (preview.mime.startsWith("audio/")) {
        return (
          <div className="flex justify-center py-8">
            <audio controls src={preview.dataUrl} className="w-full max-w-md" />
          </div>
        );
      }
      if (preview.mime.startsWith("video/")) {
        return <video controls src={preview.dataUrl} className="max-h-[70vh] w-full" />;
      }
      if (preview.text !== null) {
        return (
          <pre className="clide-scroll max-h-[70vh] overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-[12px] text-white/80">
            {preview.text}
          </pre>
        );
      }
    }

    // No inline preview for this type — file info + actions.
    return (
      <div className="flex flex-col items-center gap-4 py-14 text-center">
        <div>
          <p className="mb-1 text-[14px] font-medium text-white">{artifact.name}</p>
          <p className="text-[12px] text-white/40">
            {artifact.mime}
            {artifact.size !== undefined && ` · ${formatSize(artifact.size)}`}
          </p>
        </div>
        {actionButtons}
      </div>
    );
  };

  return (
    <Modal onClose={onClose} widthClassName="w-auto max-w-4xl" panelClassName="overflow-hidden">
      <div className="flex items-center justify-between border-b border-clide-border px-4 py-3">
        <span className="truncate text-[14px] font-bold text-white">{artifact.name}</span>
      </div>
      <div className="clide-scroll max-h-[80vh] overflow-auto bg-clide-bg">{renderPreview()}</div>
    </Modal>
  );
}
