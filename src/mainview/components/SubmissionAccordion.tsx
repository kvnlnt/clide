import { useState } from "react";
import type {
  FormDefinition,
  OutputChunk,
  OutputType,
  RunRecord,
} from "../types/forms";
import SubmissionAccordionRow from "./SubmissionAccordionRow";

interface SubmissionAccordionProps {
  runs: RunRecord[];
  form: FormDefinition;
  outputType?: OutputType;
  chunks: Record<string, OutputChunk[]>;
  activeTab: "results" | "submitted";
}

export default function SubmissionAccordion({
  runs,
  form,
  outputType,
  chunks,
  activeTab,
}: SubmissionAccordionProps) {
  // Open the latest run by default.
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set([runs[0]?.id].filter(Boolean) as string[]),
  );

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col divide-y divide-clide-border">
      {runs.map((run) => (
        <SubmissionAccordionRow
          key={run.id}
          run={run}
          form={form}
          outputType={outputType}
          chunks={chunks[run.id] ?? []}
          open={openIds.has(run.id)}
          onToggle={() => toggle(run.id)}
          activeTab={activeTab}
        />
      ))}
    </div>
  );
}
