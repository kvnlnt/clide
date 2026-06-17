import { useEffect, useState } from "react";
import { api } from "../../rpc";
import OutputToolbar from "./OutputToolbar";

interface CodeOutputProps {
  formSlug: string;
}

export default function CodeOutput({ formSlug }: CodeOutputProps) {
  const [script, setScript] = useState<string | null>(null);
  const [extension, setExtension] = useState("");
  const [expanded, setExpanded] = useState(false);

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

  const copyText = () => {
    if (script) void navigator.clipboard?.writeText(script);
  };

  return (
    <div className="overflow-hidden rounded-[5px] border border-clide-border bg-clide-bg">
      <OutputToolbar
        label={extension ? `.${extension}` : "CODE"}
        expanded={expanded}
        onToggleExpand={() => setExpanded((e) => !e)}
        onCopy={script ? copyText : undefined}
      />
      <div
        className="clide-scroll overflow-auto px-3 py-2 font-mono text-[13px] leading-relaxed"
        style={expanded ? undefined : { maxHeight: 400 }}
      >
        {script === null ? (
          <span className="text-white/30">Loading…</span>
        ) : script ? (
          <pre className="whitespace-pre-wrap break-words text-white/80">
            {script}
          </pre>
        ) : (
          <span className="text-white/30">No script found.</span>
        )}
      </div>
    </div>
  );
}
