interface TextOutputProps {
  stdout: string;
  stderr: string;
  maxHeight: number | null;
}

export default function TextOutput({ stdout, stderr, maxHeight }: TextOutputProps) {
  return (
    <div
      className="clide-scroll overflow-auto px-3 py-2 font-mono text-[13px] leading-relaxed"
      style={maxHeight ? { maxHeight } : undefined}
    >
      {stdout && <pre className="whitespace-pre-wrap break-words text-white/80">{stdout}</pre>}
      {stderr && <pre className="whitespace-pre-wrap break-words text-[rgba(255,100,100,0.85)]">{stderr}</pre>}
      {!stdout && !stderr && <span className="text-white/30">No output.</span>}
    </div>
  );
}
