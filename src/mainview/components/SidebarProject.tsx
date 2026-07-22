import { Check } from "lucide-react";

interface SidebarProjectProps {
  name: string;
  active: boolean;
  unreadSuccess: number;
  unreadError: number;
  /** Relative-time note for the most recent run in this project, e.g. "5m ago". */
  recency: string | null;
  hasRunning?: boolean;
  onClick: () => void;
  /** Present only when there's something to clear (ticket 126 explicit "mark all read"). */
  onMarkRead?: () => void;
}

/** Two-line project row (ticket 126): name on line one, status chips + recency on line two. */
export default function SidebarProject({
  name,
  active,
  unreadSuccess,
  unreadError,
  recency,
  hasRunning,
  onClick,
  onMarkRead,
}: SidebarProjectProps) {
  const hasUnread = unreadSuccess + unreadError > 0;
  const hasStatusLine = hasUnread || recency;

  return (
    <div
      className={`group flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 ${
        active ? "clide-active-row" : "hover:bg-white/[0.03]"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
          <span className={`flex-1 truncate text-[14px] ${active ? "font-bold text-white" : "text-white/60"}`}>
            {name}
          </span>
        </button>
        {!hasUnread && hasRunning && (
          <span className="flex h-[6px] w-[6px] shrink-0 animate-pulse rounded-full bg-white/30" title="Running" />
        )}
      </div>
      {hasStatusLine && (
        <div className="flex items-center gap-1.5 pl-0.5 text-[11px]">
          {unreadSuccess > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-green-500/15 px-1.5 py-[1px] font-semibold text-green-400">
              {unreadSuccess} ✓
            </span>
          )}
          {unreadError > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-red-500/15 px-1.5 py-[1px] font-semibold text-red-400">
              {unreadError} ✗
            </span>
          )}
          {recency && <span className="truncate text-white/30">latest {recency}</span>}
          {onMarkRead && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead();
              }}
              title="Mark all read"
              className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white/30 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
            >
              <Check size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
