import {
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  FolderCog,
  Plus,
  Settings,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useApp, type PanelKind } from "../context/AppContext";
import PortalPopover from "./PortalPopover";
import ViewFilterEditor from "./ViewFilterEditor";

/**
 * Browser-style tab strip hosted in the window-controls header. The first tab
 * is the project title tab — it names the active project and, when active,
 * hosts the project menu (Forms / Settings / hidden views). User views follow
 * and can be drag-sorted; the active view tab's chevron opens a menu with all
 * view controls (edit / hide / delete). A "+" creates a new view and opens its
 * filter editor. Open panel tabs render last as closeable tabs with an × and
 * no dropdown.
 */
export default function ViewTabs() {
  const {
    activeProject,
    views,
    activeViewId,
    setActiveView,
    createView,
    updateView,
    deleteView,
    reorderView,
    openPanels,
    activePanel,
    openPanel,
    closePanel,
    focusPanel,
  } = useApp();
  const [editing, setEditing] = useState<{ id: string; isNew: boolean } | null>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [viewMenuId, setViewMenuId] = useState<string | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const projectMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const viewMenuAnchorRef = useRef<HTMLElement | null>(null);
  const dragIdRef = useRef<string | null>(null);

  const editingView = editing ? views.find((v) => v.id === editing.id) : undefined;
  const menuView = viewMenuId ? views.find((v) => v.id === viewMenuId) : undefined;
  // Hidden views don't render at all.
  const visibleViews = views.filter((v) => !v.hidden);
  const hiddenViews = views.filter((v) => v.hidden);

  const openEditor = (id: string, isNew: boolean, anchor: HTMLElement) => {
    anchorRef.current = anchor;
    setEditing({ id, isNew });
  };

  const closeEditor = useCallback(() => setEditing(null), []);

  /** Dismiss without saving — a brand-new view is removed entirely. */
  const dismissEditor = useCallback(() => {
    if (editing?.isNew) deleteView(editing.id);
    setEditing(null);
  }, [editing, deleteView]);

  const openViewMenu = (id: string, anchor: HTMLElement) => {
    viewMenuAnchorRef.current = anchor;
    setViewMenuId((cur) => (cur === id ? null : id));
  };

  const menuItem = "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-white/80 hover:bg-white/5";

  const tabShape =
    "flex min-w-0 items-center gap-2 rounded-tl-[12px] rounded-tr-[12px] px-4 pb-1.5 pt-2 text-sm transition-colors";
  const activeShape = "relative z-10 -mb-px border-l border-t border-r border-white/10 bg-clide-bg text-white";
  const inactiveShape = "text-white/30 hover:bg-white/[0.03] hover:text-white";

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
    <div className="relative flex min-w-0 flex-1 items-end justify-start gap-0.5 pl-3 pr-2">
      {activeProject && (
        <div className={`${tabShape} max-w-[200px] shrink-0 ${titleTabActive ? activeShape : inactiveShape}`}>
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
          {titleTabActive && (
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
          )}
        </div>
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

      {visibleViews.map((view) => {
        const isActive = view.id === activeViewId && activePanel === null;
        return (
          <div
            key={view.id}
            draggable
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
              onClick={(e) => {
                if (isActive) openViewMenu(view.id, e.currentTarget);
                else setActiveView(view.id);
              }}
              title={view.name}
              className="min-w-0 max-w-[120px] truncate text-left"
            >
              {view.name}
            </button>
            {isActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openViewMenu(view.id, e.currentTarget);
                }}
                title="View menu"
                className="-mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"
              >
                <ChevronDown size={13} />
              </button>
            )}
          </div>
        );
      })}

      <PortalPopover
        open={menuView !== undefined}
        anchorRef={viewMenuAnchorRef}
        onClose={() => setViewMenuId(null)}
        className="w-44 overflow-hidden rounded-md border border-clide-border bg-clide-panel py-1 shadow-xl"
      >
        {menuView && (
          <>
            <button
              className={menuItem}
              onClick={() => {
                setViewMenuId(null);
                anchorRef.current = viewMenuAnchorRef.current;
                setEditing({ id: menuView.id, isNew: false });
              }}
            >
              <SlidersHorizontal size={14} /> Edit filters…
            </button>
            <button
              className={menuItem}
              onClick={() => {
                updateView({ ...menuView, hidden: true });
                if (menuView.id === activeViewId) setActiveView(null);
                setViewMenuId(null);
              }}
            >
              <Eye size={14} /> Hide tab
            </button>
            <button
              className={`${menuItem} text-red-400 hover:text-red-300`}
              onClick={() => {
                deleteView(menuView.id);
                setViewMenuId(null);
              }}
            >
              <Trash2 size={14} /> Delete view
            </button>
          </>
        )}
      </PortalPopover>

      <button
        disabled={!activeProject}
        onClick={(e) => {
          const view = createView();
          if (view) openEditor(view.id, true, e.currentTarget);
        }}
        title={activeProject ? "New view" : "Select a project to create views"}
        className={`ml-1.5 h-6 w-6 shrink-0 items-center justify-center self-center rounded-full text-white/30 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/30 ${
          activeProject ? "flex" : "hidden"
        }`}
      >
        <Plus size={15} />
      </button>

      {openPanels.map((kind) => {
        const { label, icon: Icon } = PANEL_META[kind];
        const isActive = activePanel === kind;
        return (
          <div key={kind} className={`${tabShape} shrink-0 ${isActive ? activeShape : inactiveShape}`}>
            <button
              onClick={() => focusPanel(kind)}
              title={label}
              className="flex min-w-0 max-w-[160px] items-center gap-1.5 truncate text-left"
            >
              <Icon size={13} className="shrink-0" />
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

      <PortalPopover open={editing !== null && editingView !== undefined} anchorRef={anchorRef} onClose={dismissEditor}>
        {editing && editingView && <ViewFilterEditor view={editingView} isNew={editing.isNew} onClose={closeEditor} />}
      </PortalPopover>
    </div>
  );
}
