import { ClipboardList, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { api } from "../../rpc";
import { useUIFeedback } from "../UIFeedback";

/**
 * Reports surface (ticket 134): curated, exportable collections of a
 * project's tasks/workflows/files. List + New/Edit/Export/Delete — the
 * builder itself is the full-window ReportEditor overlay.
 */
export default function ReportsPage() {
  const { activeProject, reports, deleteReportById, openReportEditor } = useApp();
  const { confirm, toast } = useUIFeedback();

  const remove = async (id: string, name: string) => {
    const res = await confirm({
      title: `Delete report "${name}"?`,
      message: "Its definition is removed; past exported files are kept.",
      confirmLabel: "Delete",
    });
    if (!res.ok) return;
    await deleteReportById(id);
    toast("Report deleted");
  };

  const exportMarkdown = async (id: string) => {
    if (!activeProject) return;
    const res = await api.exportReportMarkdown(activeProject, id);
    if (!res.ok || !res.path) {
      toast(res.error ?? "Export failed", "error");
      return;
    }
    toast(`Exported to ${res.path}`);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-baseline gap-2 px-[var(--clide-page-x)] pb-4 pt-[var(--clide-page-top)]">
        <h1 className="text-[20px] font-bold text-white">Reports</h1>
        <span className="text-[13px] text-white/40">{activeProject}</span>
        <div className="flex-1" />
        <button
          onClick={() => openReportEditor()}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] text-white/60 hover:bg-white/5 hover:text-white"
        >
          <Plus size={13} /> New report
        </button>
      </div>

      <div className="clide-scroll flex-1 overflow-y-auto px-[var(--clide-page-x)] pb-[var(--clide-page-bottom)]">
        {reports.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
              <ClipboardList size={20} className="text-white/40" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[14px] font-medium text-white/70">No reports yet</span>
              <span className="text-[13px] text-white/40">
                Curate tasks, workflows, and files into a shareable progress report.
              </span>
            </div>
            <button
              onClick={() => openReportEditor()}
              className="rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20"
            >
              New report
            </button>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-white/5 border-t border-white/5">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <span className="truncate text-[14px] text-white">{r.name}</span>
                  <span className="block truncate text-[12px] text-white/40">
                    {r.members.length} section{r.members.length === 1 ? "" : "s"}
                    {r.description ? ` — ${r.description}` : ""} · updated {new Date(r.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => void exportMarkdown(r.id)}
                    title="Export to Markdown"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
                  >
                    <Download size={13} />
                  </button>
                  <button
                    onClick={() => openReportEditor(r)}
                    title="Edit"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => void remove(r.id, r.name)}
                    title="Delete"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-red-400/70 hover:bg-white/10 hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
