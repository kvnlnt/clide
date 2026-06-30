import { FileX, FolderOpen, Trash2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../rpc";
import type { FormFolder } from "../types/forms";

interface ProjectFormsManagerProps {
  projectPath: string;
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function FormRow({ form }: { form: FormFolder }) {
  const { deleteForm } = useApp();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    const res = await deleteForm(form.projectPath, form.meta.slug);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Delete failed");
      setConfirming(false);
    }
  };

  return (
    <div className="rounded-md px-2.5 py-2 hover:bg-white/5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-white">{form.meta.name}</div>
          {form.meta.description && (
            <div className="truncate text-[12px] text-white/50">{form.meta.description}</div>
          )}
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/40">
            <span>{form.meta.slug}</span>
            {form.meta.interpreter && (
              <>
                <span>·</span>
                <span>{form.meta.interpreter}</span>
              </>
            )}
            <span>·</span>
            <span>Updated {formatUpdatedAt(form.meta.updatedAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void api.openFolder(`${form.projectPath}/forms/${form.meta.slug}`)}
            title="Reveal folder in Finder"
            className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"
          >
            <FolderOpen size={13} />
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            title="Delete form"
            className="flex h-6 w-6 items-center justify-center rounded text-red-400/70 hover:bg-white/10 hover:text-red-400"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {error && <div className="mt-1.5 text-[11px] text-red-400">{error}</div>}

      {confirming && (
        <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-white/5 bg-clide-surface px-2.5 py-2">
          <span className="text-[12px] text-white/70">
            Delete form “{form.meta.name}”? Files on disk are removed.
          </span>
          <div className="flex gap-1.5">
            <button
              disabled={busy}
              onClick={() => void remove()}
              className="rounded-md bg-red-500/80 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-500 disabled:opacity-40"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-md px-2.5 py-1 text-[11px] text-white/50 hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectFormsManager({ projectPath }: ProjectFormsManagerProps) {
  const { forms } = useApp();
  const projectForms = forms
    .filter((f) => f.projectPath === projectPath)
    .sort((a, b) => a.meta.name.localeCompare(b.meta.name));

  if (projectForms.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
        <FileX size={20} className="text-white/20" />
        <span className="text-[12px] text-white/40">No forms yet — create one from the command bar.</span>
      </div>
    );
  }

  return (
    <div className="clide-scroll flex max-h-[360px] flex-col gap-0.5 overflow-y-auto px-2 py-2">
      {projectForms.map((form) => (
        <FormRow key={form.meta.slug} form={form} />
      ))}
    </div>
  );
}
