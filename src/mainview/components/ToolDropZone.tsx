import { useState, type ReactNode } from "react";

interface Props {
  onFiles: (files: File[]) => void;
  children: ReactNode;
  className?: string;
}

/**
 * Shared drag-and-drop affordance (ticket 55) for registering a custom CLI
 * tool. Wraps its children; shows a dashed overlay on drag-over and hands
 * the dropped files back to the caller, which owns the registration queue.
 */
export default function ToolDropZone({ onFiles, children, className }: Props) {
  const [over, setOver] = useState(false);

  return (
    <div
      className={`relative ${className ?? ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files ?? []);
        if (files.length > 0) onFiles(files);
      }}
    >
      {children}
      {over && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-amber-300/60 bg-amber-300/10 backdrop-blur-[1px]">
          <span className="rounded-md bg-clide-bg px-3 py-1.5 text-[13px] font-medium text-amber-200 shadow-lg">
            Drop to register as a tool
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Webviews don't expose a dropped file's real filesystem path, so the bytes
 * themselves are what gets sent to the main process (which copies them into
 * CLIDE's own tool storage — see `storeDroppedBinary`).
 */
export async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
