import { LayoutGrid, List } from "lucide-react";
import { useApp } from "../context/AppContext";
import type { RunGroup } from "../hooks/useThread";
import { useThread } from "../hooks/useThread";
import type { RunRecord } from "../types/forms";
import FormCard from "./FormCard";
import NewFormCard from "./NewFormCard";
import ThreadDateGroup from "./ThreadDateGroup";
import ThreadEmpty from "./ThreadEmpty";

export default function Thread() {
  const {
    drafts,
    formsBySlug,
    chunks,
    activeProject,
    submitRun,
    scheduleRun,
    cancelRun,
    rerun,
    setPinned,
    deleteRun,
    removeDraft,
    setViewMode,
    viewMode,
  } = useApp();
  const { groups, visibleRuns } = useThread();

  const isEmpty = drafts.length === 0 && visibleRuns.length === 0;

  const renderGroup = (group: RunGroup) => {
    const folder = formsBySlug.get(group.formSlug);
    if (!folder) return null;
    const latestRun = group.runs[0];
    return (
      <FormCard
        key={group.key}
        runs={group.runs}
        form={folder.form}
        meta={folder.meta}
        outputType={folder.form.outputType}
        chunks={chunks}
        onSubmit={(values) => void submitRun(group.formSlug, values)}
        onCancel={() => void cancelRun(latestRun.id)}
        onSchedule={(values, at, repeat) =>
          void scheduleRun(group.formSlug, values, at, repeat)
        }
        onPin={() => void setPinned(latestRun.id, !latestRun.pinned)}
        onDelete={(runId) => void deleteRun(runId)}
        onRerun={() => void rerun(latestRun)}
      />
    );
  };

  return (
    <div className="clide-scroll flex-1 overflow-y-auto">
      <div className="flex justify-end p-3">
        <button
          className="text-white/30 transition-colors hover:text-white flex items-center justify-center rounded-full"
          onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
          title="Toggle view"
        >
          {viewMode === "list" ? <List size={18} /> : <LayoutGrid size={18} />}
        </button>
      </div>
      <div className="flex flex-col gap-3 pl-1.5 pr-3">
        {isEmpty ? (
          <div className="h-[60vh]">
            <ThreadEmpty />
          </div>
        ) : (
          <>
            {drafts.map((draft) => {
              if (draft.kind === "new-form") {
                return (
                  <NewFormCard
                    key={draft.id}
                    draftId={draft.id}
                    defaultProject={activeProject ?? ""}
                  />
                );
              }
              const folder = draft.formSlug
                ? formsBySlug.get(draft.formSlug)
                : undefined;
              if (!folder || !draft.formSlug) return null;
              const slug = draft.formSlug;
              const synthetic: RunRecord = {
                id: draft.id,
                formSlug: slug,
                inputs: {},
                status: "idle",
                exitCode: null,
                startedAt: new Date().toISOString(),
                finishedAt: null,
                outputPath: null,
                pinned: false,
                scheduledAt: null,
                repeatInterval: null,
              };
              return (
                <FormCard
                  key={draft.id}
                  runs={[synthetic]}
                  form={folder.form}
                  meta={folder.meta}
                  defaultExpanded
                  onSubmit={(values) => {
                    void submitRun(slug, values);
                    removeDraft(draft.id);
                  }}
                  onCancel={() => removeDraft(draft.id)}
                  onSchedule={(values, at, repeat) => {
                    void scheduleRun(slug, values, at, repeat);
                    removeDraft(draft.id);
                  }}
                  onPin={() => {}}
                  onDelete={() => removeDraft(draft.id)}
                  onRerun={() => {}}
                  onDismiss={() => removeDraft(draft.id)}
                />
              );
            })}

            {groups.map((group) => (
              <div key={group.label} className="flex flex-col gap-2">
                <ThreadDateGroup label={group.label} />
                {group.items.map(renderGroup)}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
