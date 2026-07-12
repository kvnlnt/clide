import { CalendarDays, FileText, Layers, Play, Settings, Wrench } from "lucide-react";
import { useApp } from "../context/AppContext";
import Toolbar from "./Toolbar";

/**
 * Toolbar for the project title tab: fused visually to the active tab above
 * it. Replaces the old ChevronDown dropdown (Forms / Settings / Hidden views)
 * — those surfaces now live as toolbar buttons that swap the title tab's body
 * content in place. Hidden-view management lives on the Views page now.
 */
export default function ProjectToolbar() {
  const { projectSurface, setProjectSurface, openRunPicker } = useApp();

  const btnBase = "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] transition-colors";
  const btnActive = "bg-white/10 text-white";
  const btnInactive = "text-white/50 hover:bg-white/5 hover:text-white";

  return (
    <Toolbar className="bg-white/10">
      <button onClick={openRunPicker} title="Run a form (⌘K)" className={`${btnBase} ${btnInactive}`}>
        <Play size={13} />
        Run
      </button>
      <button
        onClick={() => setProjectSurface(projectSurface === "calendar" ? "thread" : "calendar")}
        className={`${btnBase} ${projectSurface === "calendar" ? btnActive : btnInactive}`}
      >
        <CalendarDays size={13} />
        Calendar
      </button>
      <button
        onClick={() => setProjectSurface(projectSurface === "forms" ? "thread" : "forms")}
        className={`${btnBase} ${projectSurface === "forms" ? btnActive : btnInactive}`}
      >
        <FileText size={13} />
        Forms
      </button>
      <button
        onClick={() => setProjectSurface(projectSurface === "views" ? "thread" : "views")}
        className={`${btnBase} ${projectSurface === "views" ? btnActive : btnInactive}`}
      >
        <Layers size={13} />
        Views
      </button>
      <button
        onClick={() => setProjectSurface(projectSurface === "tools" ? "thread" : "tools")}
        className={`${btnBase} ${projectSurface === "tools" ? btnActive : btnInactive}`}
      >
        <Wrench size={13} />
        Tools
      </button>
      <button
        onClick={() => setProjectSurface(projectSurface === "project-settings" ? "thread" : "project-settings")}
        className={`${btnBase} ${projectSurface === "project-settings" ? btnActive : btnInactive}`}
      >
        <Settings size={13} />
        Settings
      </button>
    </Toolbar>
  );
}
