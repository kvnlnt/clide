interface TextOutputProps {
  stdout: string;
  stderr: string;
}

export default function TextOutput({ stdout, stderr }: TextOutputProps) {
  return (
    <div
      className="clide-scroll resize-y overflow-auto px-3 py-2 font-mono text-[13px] leading-relaxed"
      style={{ height: 400, minHeight: 120, maxHeight: 1000 }}
    >
      {stdout && <pre className="whitespace-pre-wrap break-words text-white/80">{stdout}</pre>}
      {stderr && <pre className="whitespace-pre-wrap break-words text-[rgba(255,100,100,0.85)]">{stderr}</pre>}
      {!stdout && !stderr && <span className="text-white/30">No output.</span>}
    </div>
  );
}
