import { useMemo, useState } from "react";

interface TableData {
  columns: string[];
  rows: string[][];
}

function parseDelimited(text: string, delimiter: string): TableData {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { columns: [], rows: [] };
  const split = (line: string) => line.split(delimiter).map((c) => c.trim());
  const columns = split(lines[0]);
  const rows = lines.slice(1).map(split);
  return { columns, rows };
}

function parseTable(text: string): TableData {
  const trimmed = text.trim();
  if (!trimmed) return { columns: [], rows: [] };

  // JSON array of objects.
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed) as Record<string, unknown>[];
      if (Array.isArray(arr) && arr.length > 0) {
        const columns = Array.from(
          arr.reduce((set, row) => {
            Object.keys(row).forEach((k) => set.add(k));
            return set;
          }, new Set<string>()),
        );
        const rows = arr.map((row) =>
          columns.map((c) => (row[c] === undefined || row[c] === null ? "" : String(row[c]))),
        );
        return { columns, rows };
      }
    } catch {
      /* fall through to delimited parsing */
    }
  }

  // TSV vs CSV detection.
  const firstLine = trimmed.split(/\r?\n/)[0];
  return parseDelimited(trimmed, firstLine.includes("\t") ? "\t" : ",");
}

export function tableRowCount(text: string): number {
  return parseTable(text).rows.length;
}

interface TableOutputProps {
  text: string;
}

export default function TableOutput({ text }: TableOutputProps) {
  const data = useMemo(() => parseTable(text), [text]);
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null);

  const rows = useMemo(() => {
    if (!sort) return data.rows;
    const sorted = [...data.rows].sort((a, b) => {
      const av = a[sort.col] ?? "";
      const bv = b[sort.col] ?? "";
      const an = Number(av);
      const bn = Number(bv);
      if (!Number.isNaN(an) && !Number.isNaN(bn)) return (an - bn) * sort.dir;
      return av.localeCompare(bv) * sort.dir;
    });
    return sorted;
  }, [data.rows, sort]);

  if (data.columns.length === 0) {
    return <div className="px-3 py-2 text-[13px] text-white/30">No table data.</div>;
  }

  const toggleSort = (col: number) =>
    setSort((prev) => (prev && prev.col === col ? { col, dir: prev.dir === 1 ? -1 : 1 } : { col, dir: 1 }));

  return (
    <div className="clide-scroll resize-y overflow-auto" style={{ height: 400, minHeight: 120, maxHeight: 1000 }}>
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 bg-clide-bg">
          <tr>
            {data.columns.map((col, i) => (
              <th
                key={col}
                onClick={() => toggleSort(i)}
                className="cursor-pointer select-none whitespace-nowrap border-b border-clide-border px-3 py-1.5 text-left font-bold text-white/70 hover:text-white"
              >
                {col}
                {sort?.col === i ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 ? "bg-white/[0.02]" : ""}>
              {data.columns.map((_, ci) => (
                <td key={ci} className="whitespace-nowrap px-3 py-1 text-white/80">
                  {row[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
