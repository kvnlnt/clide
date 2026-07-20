import { Check } from "lucide-react";

export interface WizardStepDef {
  label: string;
  /** Clickable/enterable. Unreachable steps render inert with `hint` as the tooltip. */
  reachable: boolean;
  hint?: string;
}

interface Props {
  steps: WizardStepDef[];
  /** 1-based, matching the wizard's own step numbering. */
  current: number;
  onSelect: (step: number) => void;
}

/**
 * Header step indicator for the task-creation wizard (ticket 63): every step
 * visible with its name, one click jumps to any reachable step. States:
 * complete (visited-and-behind), current, upcoming-reachable, unreachable.
 */
export default function WizardSteps({ steps, current, onSelect }: Props) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const n = i + 1;
        const isCurrent = n === current;
        const isComplete = n < current;
        const clickable = step.reachable && !isCurrent;
        return (
          <div key={step.label} className="flex items-center gap-1">
            {i > 0 && <div className={`h-px w-4 ${n <= current ? "bg-white/30" : "bg-white/10"}`} />}
            <button
              onClick={() => clickable && onSelect(n)}
              disabled={!step.reachable}
              title={step.reachable ? step.label : step.hint ?? step.label}
              className={`flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-2.5 text-[12px] transition-colors ${
                isCurrent
                  ? "bg-white/10 font-medium text-white"
                  : clickable
                    ? "text-white/60 hover:bg-white/5 hover:text-white"
                    : "cursor-default text-white/25"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                  isComplete
                    ? "bg-green-500/20 text-green-400"
                    : isCurrent
                      ? "bg-white/20 text-white"
                      : "bg-white/10 text-white/40"
                }`}
              >
                {isComplete ? <Check size={10} /> : n}
              </span>
              {step.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
