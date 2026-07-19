/**
 * Modal for editing browser automation steps of an existing native task (ticket 99 slice 2).
 */

import { X } from "lucide-react";
import type { TaskFolder } from "../types/tasks";
import StepBuilder from "./browser/StepBuilder";
import { useEscapeToClose } from "./Modal";

interface Props {
  folder: TaskFolder;
  onClose: () => void;
  onSave: () => void;
}

export default function BrowserStepsEditorModal({ folder, onClose, onSave }: Props) {
  const config = folder.native?.browser ?? { steps: [] };
  const isAdopted = folder.meta.lifecycle === "adopted";

  const handleSave = () => {
    // The save is already handled by StepBuilder calling saveBrowserConfig RPC
    onSave();
  };

  useEscapeToClose(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-clide-border bg-clide-panel shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-clide-border px-6 py-4">
          <div>
            <h2 className="text-[18px] font-bold text-white">Edit Browser Steps</h2>
            <p className="text-[13px] text-white/50">{folder.meta.name}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="clide-scroll flex-1 overflow-y-auto p-6">
          <StepBuilder
            projectPath={folder.projectPath}
            slug={folder.meta.slug}
            config={config}
            onSave={handleSave}
            readOnly={isAdopted}
          />
        </div>
      </div>
    </div>
  );
}
