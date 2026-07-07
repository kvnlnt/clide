import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../rpc";
import OutputToolbar from "./OutputToolbar";

interface CodeOutputProps {
  formSlug: string;
}

export default function CodeOutput({ formSlug }: CodeOutputProps) {
  const { formsBySlug } = useApp();
  const [script, setScript] = useState<string | null>(null);
  const [extension, setExtension] = useState("");

  useEffect(() => {
    let cancelled = false;
    setScript(null);
    void api.getFormScript(formSlug).then((res) => {
      if (cancelled) return;
      setScript(res?.script ?? "");
      setExtension(res?.extension ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [formSlug]);

  const reveal = () => {
    const folder = formsBySlug.get(formSlug);
    if (folder) void api.openFolder(`${folder.projectPath}/forms/${formSlug}`);
  };

  return (
    <div className="overflow-hidden rounded-[5px] border border-clide-border bg-clide-bg">
      <OutputToolbar label={extension ? `.${extension}` : "CODE"} onReveal={reveal} />
      <div
        className="clide-scroll resize-y overflow-auto px-3 py-2 font-mono text-[13px] leading-relaxed"
        style={{ height: 400, minHeight: 120, maxHeight: 1000 }}
      >
        {script === null ? (
          <span className="text-white/30">Loading…</span>
        ) : script ? (
          <pre className="whitespace-pre-wrap break-words text-white/80">{script}</pre>
        ) : (
          <span className="text-white/30">No script found.</span>
        )}
      </div>
    </div>
  );
}
