import { Loader, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useApp } from "../../context/AppContext";
import { api } from "../../rpc";
import type { Workflow } from "../../types/forms";
import { useEscapeToClose } from "../Modal";
import ServiceModelPicker, { type ServiceModelValue } from "../ServiceModelPicker";
import WorkflowEditor from "./WorkflowEditor";

const inputBase =
  "w-full rounded border border-clide-border bg-clide-surface text-white text-[13px] px-2.5 py-1.5 outline-none placeholder:text-white/30 focus:border-white/30";

function emptyWorkflow(name: string, description: string): Workflow {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: name.trim() || "New workflow",
    description,
    steps: [],
    triggers: [{ type: "manual" }],
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Workflow creation wizard (ticket 92): describe the goal → the AI drafts
 * steps and wiring against the project's EXISTING forms → fine-tune in the
 * editor. AI accelerates, never gates — "Start empty" always works.
 */
export default function NewWorkflowWizard({ onClose }: { onClose: () => void }) {
  const { activeProject, forms } = useApp();
  const [goal, setGoal] = useState("");
  const [name, setName] = useState("");
  const [serviceModel, setServiceModel] = useState<ServiceModelValue>({ serviceId: "", model: "" });
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ workflow: Workflow; notes: string[] } | null>(null);

  const projectForms = forms.filter((f) => f.meta.project === activeProject);

  useEscapeToClose(onClose, draft === null);

  const runDraft = async () => {
    if (!activeProject || !goal.trim() || !serviceModel.serviceId) return;
    setDrafting(true);
    setError(null);
    const res = await api.draftWorkflow(
      activeProject,
      goal.trim(),
      name.trim(),
      serviceModel.serviceId,
      serviceModel.model,
    );
    setDrafting(false);
    if (!res.ok || !res.workflow) {
      setError(res.error ?? "Couldn't draft a workflow.");
      return;
    }
    const stepCount = res.workflow.steps.length;
    setDraft({
      workflow: res.workflow,
      notes: [
        `AI drafted ${stepCount} step${stepCount === 1 ? "" : "s"} from your forms — review the wiring before saving.`,
        ...(res.notes ?? []),
      ],
    });
  };

  // Fine-tune stage: the ticket-82 editor over the drafted (or empty) value.
  if (draft) {
    return <WorkflowEditor initial={draft.workflow} onClose={onClose} draftNotes={draft.notes} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-4 px-8 pb-4 pt-7">
        <h1 className="shrink-0 text-[20px] font-bold text-white">New workflow</h1>
        <div className="flex-1" />
        <button
          onClick={onClose}
          title="Cancel"
          className="flex h-8 w-8 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="clide-scroll min-h-0 flex-1 overflow-y-auto px-8 pb-4">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
          {projectForms.length === 0 && (
            <div className="rounded border border-amber-500/40 bg-amber-500/5 p-3 text-[13px] text-amber-200">
              This project has no forms yet — workflows orchestrate existing forms, so create a form first.
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-bold text-white/70">What should this workflow do?</label>
            <span className="text-[12px] text-white/40">
              Describe the goal — CLIDE will assemble steps from this project's {projectForms.length} form
              {projectForms.length === 1 ? "" : "s"} and wire their outputs to inputs.
            </span>
            <textarea
              autoFocus
              className={`${inputBase} min-h-[88px] resize-y`}
              placeholder="Fetch the RSS feed, and for each new item, post it to the channel…"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-bold text-white/70">Name</label>
            <input
              className={inputBase}
              placeholder="Publish digest"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-bold text-white/70">
              AI assistance <span className="font-normal text-white/40">(optional)</span>
            </label>
            <ServiceModelPicker value={serviceModel} onChange={setServiceModel} />
          </div>

          {drafting && (
            <div className="flex items-center gap-2 text-[13px] text-white/60">
              <Loader size={14} className="animate-spin" />
              Drafting a workflow from your forms…
            </div>
          )}
          {error && (
            <div className="rounded border border-red-500/40 bg-red-500/5 p-3 text-[13px] text-red-300">{error}</div>
          )}
        </div>
      </div>

      <div className="mt-auto flex shrink-0 items-center justify-end gap-2 border-t border-clide-border px-8 py-4">
        <button
          onClick={() => setDraft({ workflow: emptyWorkflow(name, goal.trim()), notes: [] })}
          className="rounded-md px-3 py-1.5 text-[13px] text-white/50 hover:bg-white/5 hover:text-white"
        >
          Start empty
        </button>
        <button
          disabled={drafting || !goal.trim() || !serviceModel.serviceId || projectForms.length === 0}
          onClick={() => void runDraft()}
          className="flex items-center gap-1.5 rounded-md bg-white/10 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
        >
          <Sparkles size={13} className="text-amber-300" />
          {drafting ? "Drafting…" : "Draft with AI"}
        </button>
      </div>
    </div>
  );
}
