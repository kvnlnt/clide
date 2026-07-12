import AutoSizeOutput from "./AutoSizeOutput";

interface TextOutputProps {
  stdout: string;
  stderr: string;
}

export default function TextOutput({ stdout, stderr }: TextOutputProps) {
  return (
    <AutoSizeOutput className="px-3 py-2 font-mono text-[13px] leading-relaxed">
      {stdout && <pre className="whitespace-pre-wrap break-words text-white/80">{stdout}</pre>}
      {stderr && <pre className="whitespace-pre-wrap break-words text-[rgba(255,100,100,0.85)]">{stderr}</pre>}
      {!stdout && !stderr && <span className="text-white/30">No output.</span>}
    </AutoSizeOutput>
  );
}
