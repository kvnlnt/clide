import { useApp } from "../context/AppContext";
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
  } = useApp();
  const { groups, visibleRuns } = useThread();

  const isEmpty = drafts.length === 0 && visibleRuns.length === 0;

  const renderRun = (run: RunRecord) => {
    const folder = formsBySlug.get(run.formSlug);
    if (!folder) return null;
    return (
      <FormCard
        key={run.id}
        run={run}
        form={folder.form}
        meta={folder.meta}
        outputType={folder.form.outputType}
        chunks={chunks[run.id] ?? []}
        onSubmit={(values) => void submitRun(run.formSlug, values)}
        onCancel={() => void cancelRun(run.id)}
        onSchedule={(values, at, repeat) => void scheduleRun(run.formSlug, values, at, repeat)}
        onPin={() => void setPinned(run.id, !run.pinned)}
        onDelete={() => void deleteRun(run.id)}
        onRerun={() => void rerun(run)}
      />
    );
  };

  return (
    <div className="clide-scroll flex-1 overflow-y-auto">
      <div className="flex flex-col gap-3 px-6 py-5">
        {isEmpty ? (
          <div className="h-[60vh]">
            <ThreadEmpty />
          </div>
        ) : (
          <>
            {drafts.map((draft) => {
              if (draft.kind === "new-form") {
                return <NewFormCard key={draft.id} draftId={draft.id} defaultProject={activeProject ?? ""} />;
              }
              const folder = draft.formSlug ? formsBySlug.get(draft.formSlug) : undefined;
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
                  run={synthetic}
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
                {group.runs.map(renderRun)}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
