import {
  ChevronDown,
  EyeOff,
  FileText,
  Folder,
  FolderCog,
  House,
  Plus,
  Settings,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { useApp, type PanelKind } from "../context/AppContext";
import PortalPopover from "./PortalPopover";

/**
 * Browser-style tab strip hosted in the window-controls header. The left side
 * is the project cluster — a Home button, the project title tab (with its
 * Forms / Settings / hidden-views menu), and any open panel tabs — rendered as
 * filled chips so it reads as a distinct family from the saved views. After a
 * separator come the view tabs: drag-sortable, the active one carrying a
 * sliders button that opens the combined view editor. "+" starts a new view
 * whose editor fills the pane body.
 */
export default function ViewTabs() {
  const {
    activeProject,
    setActiveProject,
    views,
    activeViewId,
    setActiveView,
    updateView,
    reorderView,
    newView,
    startNewView,
    editView,
    openPanels,
    activePanel,
    openPanel,
    closePanel,
    focusPanel,
  } = useApp();
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const projectMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const dragIdRef = useRef<string | null>(null);

  // Hidden views don't render; the unsaved new view renders as a trailing tab.
  const visibleViews = views.filter((v) => !v.hidden);
  const hiddenViews = views.filter((v) => v.hidden);
  const tabViews = newView ? [...visibleViews, newView] : visibleViews;

  const menuItem = "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-white/80 hover:bg-white/5";

  // View tabs: browser-style, merging into the content pane when active.
  const tabShape =
    "flex min-w-0 items-center gap-2 rounded-tl-[12px] rounded-tr-[12px] px-4 pb-1.5 pt-2 text-sm transition-colors";
  const activeShape = "relative z-10 -mb-px border-l border-t border-r border-white/10 bg-clide-bg text-white";
  const inactiveShape = "text-white/30 hover:bg-white/[0.03] hover:text-white";

  // Project cluster: filled, self-contained chips — a distinct family.
  const clusterShape =
    "flex min-w-0 shrink-0 items-center gap-1.5 self-center rounded-lg px-3 py-1.5 text-[13px] transition-colors";
  const clusterActive = "bg-white/15 text-white";
  const clusterInactive = "bg-clide-panel text-white/45 hover:bg-white/10 hover:text-white";

  const titleTabActive = activeViewId === null && activePanel === null;

  const PANEL_META: Record<PanelKind, { label: string; icon: typeof FileText }> = {
    forms: { label: "Forms", icon: FileText },
    settings: { label: "Settings", icon: Settings },
    "project-settings": {
      label: activeProject ? `${activeProject} Settings` : "Project Settings",
      icon: FolderCog,
    },
  };

  return (
    <div className="relative flex min-w-0 flex-1 items-end justify-start gap-1 pl-2 pr-2">
      {activeProject && (
        <>
          <button
            onClick={() => {
              setActiveProject(null);
              focusPanel(null);
            }}
            title="Home"
            className="flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <House size={16} />
          </button>

          <div className={`${clusterShape} max-w-[200px] ${titleTabActive ? clusterActive : clusterInactive}`}>
            <Folder size={13} className="shrink-0 opacity-70" />
            <button
              onClick={() => {
                if (titleTabActive) setProjectMenuOpen((o) => !o);
                else setActiveView(null);
              }}
              title={`All ${activeProject} threads`}
              className="min-w-0 truncate text-left"
            >
              {activeProject}
            </button>
            <button
              ref={projectMenuAnchorRef}
              onClick={(e) => {
                e.stopPropagation();
                setProjectMenuOpen((o) => !o);
              }}
              title="Project menu"
              className="-mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"
            >
              <ChevronDown size={13} />
            </button>
          </div>

          {openPanels.map((kind) => {
            const { label, icon: Icon } = PANEL_META[kind];
            const isActive = activePanel === kind;
            return (
              <div
                key={kind}
                className={`${clusterShape} max-w-[180px] ${isActive ? clusterActive : clusterInactive}`}
              >
                <button
                  onClick={() => focusPanel(kind)}
                  title={label}
                  className="flex min-w-0 items-center gap-1.5 truncate text-left"
                >
                  <Icon size={13} className="shrink-0 opacity-70" />
                  <span className="truncate">{label}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closePanel(kind);
                  }}
                  title="Close"
                  className="-mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}

          {/* Separator between the project cluster and the view tabs. */}
          <div className="mx-1 h-6 w-px shrink-0 self-center bg-white/10" />
        </>
      )}

      <PortalPopover
        open={projectMenuOpen && activeProject !== null}
        anchorRef={projectMenuAnchorRef}
        onClose={() => setProjectMenuOpen(false)}
        className="w-44 overflow-hidden rounded-md border border-clide-border bg-clide-panel py-1 shadow-xl"
      >
        <button
          className={menuItem}
          onClick={() => {
            openPanel("forms");
            setProjectMenuOpen(false);
          }}
        >
          <FileText size={14} /> Forms
        </button>
        <button
          className={menuItem}
          onClick={() => {
            openPanel("project-settings");
            setProjectMenuOpen(false);
          }}
        >
          <Settings size={14} /> Settings
        </button>
        {hiddenViews.length > 0 && (
          <>
            <div className="mx-3 mb-1 mt-2 border-t border-white/10 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/25">
              Hidden views
            </div>
            {hiddenViews.map((view) => (
              <button
                key={view.id}
                className={menuItem}
                onClick={() => {
                  updateView({ ...view, hidden: false });
                  setActiveView(view.id);
                  setProjectMenuOpen(false);
                }}
              >
                <EyeOff size={14} className="shrink-0 text-white/40" />
                <span className="min-w-0 truncate">{view.name}</span>
              </button>
            ))}
          </>
        )}
      </PortalPopover>

      {tabViews.map((view) => {
        const isActive = view.id === activeViewId && activePanel === null;
        const isNewViewTab = newView?.id === view.id;
        return (
          <div
            key={view.id}
            draggable={!isNewViewTab}
            onDragStart={(e) => {
              dragIdRef.current = view.id;
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => {
              dragIdRef.current = null;
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIdRef.current) reorderView(dragIdRef.current, view.id);
              dragIdRef.current = null;
            }}
            // Opted out of the window drag region (electrobun's class-based
            // opt-out) so HTML5 drag-sorting doesn't fight the app-region drag.
            className={`electrobun-webkit-app-region-no-drag group ${tabShape} ${isActive ? activeShape : inactiveShape}`}
          >
            <button
              onClick={() => {
                if (isNewViewTab) return;
                if (isActive) editView(view.id);
                else setActiveView(view.id);
              }}
              title={view.name}
              className="min-w-0 max-w-[120px] truncate text-left"
            >
              {view.name}
            </button>
            {isActive && !isNewViewTab && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  editView(view.id);
                }}
                title="Edit view"
                className="-mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"
              >
                <SlidersHorizontal size={12} />
              </button>
            )}
          </div>
        );
      })}

      <button
        disabled={!activeProject}
        onClick={() => startNewView()}
        title={activeProject ? "New view" : "Select a project to create views"}
        className={`ml-1.5 h-6 w-6 shrink-0 items-center justify-center self-center rounded-full text-white/30 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/30 ${
          activeProject ? "flex" : "hidden"
        }`}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
