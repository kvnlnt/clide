import { useState } from "react";
import AutoSizeOutput from "./AutoSizeOutput";

interface JsonNodeProps {
  name: string | null;
  value: unknown;
  depth: number;
}

function JsonNode({ name, value, depth }: JsonNodeProps) {
  const isObject = value !== null && typeof value === "object";
  const [open, setOpen] = useState(depth < 1);

  if (!isObject) {
    return (
      <div style={{ paddingLeft: depth * 14 }} className="font-mono text-[13px]">
        {name !== null && <span className="text-sky-300">{name}: </span>}
        <span
          className={
            typeof value === "string"
              ? "text-green-300"
              : typeof value === "number"
                ? "text-orange-300"
                : "text-purple-300"
          }
        >
          {typeof value === "string" ? `"${value}"` : String(value)}
        </span>
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);
  const bracket = Array.isArray(value) ? ["[", "]"] : ["{", "}"];

  return (
    <div style={{ paddingLeft: depth * 14 }} className="font-mono text-[13px]">
      <button className="select-none text-left text-white/80 hover:text-white" onClick={() => setOpen((o) => !o)}>
        {name !== null && <span className="text-sky-300">{name}: </span>}
        <span className="text-white/40">
          {open ? bracket[0] : `${bracket[0]}…${bracket[1]}`} {!open && `${entries.length}`}
        </span>
      </button>
      {open && (
        <div>
          {entries.map(([k, v]) => (
            <JsonNode key={k} name={k} value={v} depth={depth + 1} />
          ))}
          <div className="text-white/40">{bracket[1]}</div>
        </div>
      )}
    </div>
  );
}

interface JsonOutputProps {
  text: string;
}

export default function JsonOutput({ text }: JsonOutputProps) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return <div className="px-3 py-2 font-mono text-[13px] text-[rgba(255,100,100,0.85)]">Invalid JSON output.</div>;
  }
  return (
    <AutoSizeOutput className="px-3 py-2">
      <JsonNode name={null} value={parsed} depth={0} />
    </AutoSizeOutput>
  );
}
