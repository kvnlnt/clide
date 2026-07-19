/**
 * Artifact preview modal (ticket 102): shows file previews for run artifacts.
 * Images inline, PDF via iframe, text/JSON in <pre>, others with Open/Reveal.
 */

import { useEffect, useState } from "react";
import type { RunArtifact } from "../../../shared/types";
import { api } from "../../rpc";
import Modal from "../Modal";

interface ArtifactModalProps {
  artifact: RunArtifact;
  onClose: () => void;
}

export function ArtifactModal({ artifact, onClose }: ArtifactModalProps) {
  // Preview loading removed for now (ticket 102 - basic implementation)
  // const [preview, setPreview] = useState<{ base64: string; mime: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Deleted artifacts don't preview
    if (artifact.kind === "deleted") {
      setLoading(false);
      return;
    }

    // Extract location ID from URI
    const uriMatch = artifact.uri.match(/^([^:]+):\/\/(.+)$/);
    if (!uriMatch) {
      setError("Invalid artifact URI");
      setLoading(false);
      return;
    }

    const [, provider, path] = uriMatch;

    // TODO: For now, only local provider is supported
    if (provider !== "local") {
      setError("Remote providers not yet supported");
      setLoading(false);
      return;
    }

    // For local files, we need to find the location
    // This is a simplification - in production, we'd need to resolve the location
    // from the artifact's URI properly
    loadPreview(path);
  }, [artifact]);

  async function loadPreview(_path: string) {
    try {
      // For local files, read directly (simplified - production would use proper location resolution)
      // Since we can't easily extract locationId from the URI, we'll skip preview for now
      // and just show Open/Reveal buttons
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  const handleOpen = async () => {
    // Extract path from URI
    const path = artifact.uri.replace(/^[^:]+:\/\//, "");
    // For now, use shell open command - in production, use VFS
    try {
      await api.openFolder(path);
    } catch (err) {
      console.error("Failed to open artifact:", err);
    }
  };

  const handleReveal = async () => {
    // Extract path from URI
    const path = artifact.uri.replace(/^[^:]+:\/\//, "");
    // For now, use shell open command - in production, use VFS
    try {
      const parentDir = path.split("/").slice(0, -1).join("/");
      await api.openFolder(parentDir);
    } catch (err) {
      console.error("Failed to reveal artifact:", err);
    }
  };

  const renderPreview = () => {
    if (artifact.kind === "deleted") {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <svg className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <p className="text-lg font-medium">File Deleted</p>
          <p className="text-sm mt-1">{artifact.name}</p>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <p className="text-sm">{error}</p>
        </div>
      );
    }

    // For now, show file info and action buttons
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center mb-6">
          <p className="text-lg font-medium mb-2">{artifact.name}</p>
          <p className="text-sm text-gray-500">{artifact.mime}</p>
          {artifact.size && <p className="text-sm text-gray-500">{formatSize(artifact.size)}</p>}
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleOpen}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Open
          </button>
          <button
            onClick={handleReveal}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Reveal in Finder
          </button>
        </div>
      </div>
    );
  };

  return (
    <Modal onClose={onClose} widthClassName="w-auto max-w-4xl">
      <div className="border-b border-clide-border px-4 py-3 text-[14px] font-bold text-white">{artifact.name}</div>
      <div className="max-h-[80vh] overflow-auto">{renderPreview()}</div>
    </Modal>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
