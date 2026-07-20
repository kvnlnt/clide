import { useApp } from "../context/AppContext";
import type { RunGroup } from "../hooks/useThread";
import { useThread } from "../hooks/useThread";
import type { RunRecord } from "../types/tasks";
import TaskCard from "./TaskCard";
import ThreadDateGroup from "./ThreadDateGroup";
import ThreadEmpty from "./ThreadEmpty";
import { useUIFeedback } from "./UIFeedback";

export default function Thread() {
  const {
    drafts,
    tasksBySlug,
    chunks,
    submitRun,
    scheduleRun,
    cancelRun,
    rerun,
    setPinned,
    deleteRun,
    removeDraft,
    activeViewId,
  } = useApp();
  const { groups, visibleRuns } = useThread();
  const { confirm, toast } = useUIFeedback();

  const isEmpty = drafts.length === 0 && visibleRuns.length === 0;

  // Persisted runs get a confirm; unsubmitted drafts dismiss without one (nothing saved yet).
  const removeRun = async (runId: string) => {
    const res = await confirm({
      title: "Delete this run?",
      message: "Its output and history entry are removed.",
      confirmLabel: "Delete",
    });
    if (!res.ok) return;
    await deleteRun(runId);
    toast("Run deleted");
  };

  const renderGroup = (group: RunGroup) => {
    const folder = tasksBySlug.get(group.taskSlug);
    if (!folder) return null;
    const latestRun = group.runs[0];
    return (
      <TaskCard
        key={group.key}
        runs={group.runs}
        taskDef={folder.task}
        meta={folder.meta}
        outputType={folder.task.outputType}
        chunks={chunks}
        onSubmit={(values) => void submitRun(group.taskSlug, values)}
        onCancel={() => void cancelRun(latestRun.id)}
        onSchedule={(values, at, repeat) => void scheduleRun(group.taskSlug, values, at, repeat)}
        onPin={() => void setPinned(latestRun.id, !latestRun.pinned)}
        onDelete={(runId) => void removeRun(runId)}
        onRerun={() => void rerun(latestRun)}
      />
    );
  };

  return (
    <div className="clide-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-3 pt-3 pl-1.5 pr-3">
        {isEmpty ? (
          <div className="h-[60vh]">
            <ThreadEmpty filtered={activeViewId !== null} />
          </div>
        ) : (
          <>
            {drafts.map((draft) => {
              const folder = tasksBySlug.get(draft.taskSlug);
              if (!folder) return null;
              const slug = draft.taskSlug;
              const synthetic: RunRecord = {
                id: draft.id,
                taskSlug: slug,
                inputs: {},
                status: "idle",
                exitCode: null,
                startedAt: new Date().toISOString(),
                finishedAt: null,
                outputPath: null,
                pinned: false,
                scheduledAt: null,
                repeatInterval: null,
                readAt: null,
                taskVersion: folder.meta.version,
              };
              return (
                <TaskCard
                  key={draft.id}
                  runs={[synthetic]}
                  taskDef={folder.task}
                  meta={folder.meta}
                  defaultExpanded
                  autoFill
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
