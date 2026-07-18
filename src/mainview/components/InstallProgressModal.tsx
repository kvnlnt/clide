import { useEffect, useState } from "react";
import { on } from "../rpc";
import Modal, { useEscapeToClose } from "./Modal";

export default function InstallProgressModal({ installId, onClose }: { installId: string; onClose: () => void }) {
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEscapeToClose(onClose);

  useEffect(() => {
    const unsub1 = on("chunk", (chunk) => {
      if (!chunk.runId) return;
      if (typeof chunk.runId === "string" && chunk.runId === `install:${installId}`) {
        setLogs((s) => [...s, chunk.data as string]);
      }
    });
    const unsub2 = on("status", (update) => {
      if (!update.runId) return;
      if (typeof update.runId === "string" && update.runId === `install:${installId}`) {
        setStatus(update.status);
      }
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, [installId]);

  return (
    <Modal onClose={onClose} widthClassName="w-[720px]" panelClassName="flex max-h-[70%] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-clide-border px-4 py-3">
        <div className="text-[14px] font-bold text-white">Package install</div>
        <div className="text-[12px] text-white/50">{status ?? "running"}</div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <pre className="whitespace-pre-wrap text-[13px] text-white/80">{logs.join("") || "Waiting for output…"}</pre>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-clide-border px-4 py-3">
        <button onClick={onClose} className="rounded-md px-3 py-1.5 text-[13px] text-white/50 hover:bg-white/5">
          Close
        </button>
      </div>
    </Modal>
  );
}
