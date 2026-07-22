import { CalendarDays, ClipboardList, FileText, Files, Layers, Play, Settings, Workflow } from "lucide-react";
import { useApp } from "../context/AppContext";
import Toolbar from "./Toolbar";

/**
 * Toolbar for the project title tab: fused visually to the active tab above
 * it. Replaces the old ChevronDown dropdown (Tasks / Settings / Hidden views)
 * — those surfaces now live as toolbar buttons that swap the title tab's body
 * content in place. Hidden-view management lives on the Views page now.
 */
export default function ProjectToolbar() {
  const { projectSurface, setProjectSurface, openRunPicker } = useApp();

  const btnBase =
    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] transition-colors [.clide-compact_&]:px-1.5 [.clide-compact_&]:py-1";
  const btnActive = "bg-white/10 text-white";
  const btnInactive = "text-white/50 hover:bg-white/5 hover:text-white";
  // Toolbar tools collapse to icon-only in compact mode; the native `title`
  // tooltip on each button keeps the label available on hover.
  const label = "[.clide-compact_&]:hidden";

  return (
    <Toolbar className="bg-white/10">
      <button onClick={openRunPicker} title="Run a task (⌘K)" className={`${btnBase} ${btnInactive}`}>
        <Play size={13} />
        <span className={label}>Run</span>
      </button>
      <button
        onClick={() => setProjectSurface(projectSurface === "workflows" ? "thread" : "workflows")}
        title="Workflows (⌘⇧U)"
        className={`${btnBase} ${projectSurface === "workflows" ? btnActive : btnInactive}`}
      >
        <Workflow size={13} />
        <span className={label}>Workflows</span>
      </button>
      <button
        onClick={() => setProjectSurface(projectSurface === "tasks" ? "thread" : "tasks")}
        title="Tasks (⌘P)"
        className={`${btnBase} ${projectSurface === "tasks" ? btnActive : btnInactive}`}
      >
        <FileText size={13} />
        <span className={label}>Tasks</span>
      </button>
      <button
        onClick={() => setProjectSurface(projectSurface === "calendar" ? "thread" : "calendar")}
        title="Calendar (⌘⇧C)"
        className={`${btnBase} ${projectSurface === "calendar" ? btnActive : btnInactive}`}
      >
        <CalendarDays size={13} />
        <span className={label}>Calendar</span>
      </button>

      <button
        onClick={() => setProjectSurface(projectSurface === "files" ? "thread" : "files")}
        title="Files"
        className={`${btnBase} ${projectSurface === "files" ? btnActive : btnInactive}`}
      >
        <Files size={13} />
        <span className={label}>Files</span>
      </button>

      <button
        onClick={() => setProjectSurface(projectSurface === "views" ? "thread" : "views")}
        title="Views (⌘⇧V)"
        className={`${btnBase} ${projectSurface === "views" ? btnActive : btnInactive}`}
      >
        <Layers size={13} />
        <span className={label}>Views</span>
      </button>

      <button
        onClick={() => setProjectSurface(projectSurface === "reports" ? "thread" : "reports")}
        title="Reports (⌘⇧R)"
        className={`${btnBase} ${projectSurface === "reports" ? btnActive : btnInactive}`}
      >
        <ClipboardList size={13} />
        <span className={label}>Reports</span>
      </button>

      <button
        onClick={() => setProjectSurface(projectSurface === "project-settings" ? "thread" : "project-settings")}
        title="Project settings (⌘,)"
        className={`${btnBase} ${projectSurface === "project-settings" ? btnActive : btnInactive}`}
      >
        <Settings size={13} />
        <span className={label}>Settings</span>
      </button>
    </Toolbar>
  );
}
