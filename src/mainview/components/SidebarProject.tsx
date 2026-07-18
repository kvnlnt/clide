interface SidebarProjectProps {
  name: string;
  active: boolean;
  badgeCount: number;
  badgeColor: "red" | "green" | "orange";
  hasRunning?: boolean;
  onClick: () => void;
}

const BADGE_BG: Record<string, string> = {
  red: "bg-red-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
};

/** A plain project row: name + activity badge. Project actions live on the title tab. */
export default function SidebarProject({
  name,
  active,
  badgeCount,
  badgeColor,
  hasRunning,
  onClick,
}: SidebarProjectProps) {
  return (
    <div
      className={`group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 ${
        active ? "clide-active-row" : "hover:bg-white/[0.03]"
      }`}
    >
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
        <span className={`flex-1 truncate text-[14px] ${active ? "font-bold text-white" : "text-white/60"}`}>
          {name}
        </span>
      </button>
      {badgeCount > 0 && (
        <span
          className={`flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-1 text-[11px] font-bold text-white ${BADGE_BG[badgeColor]}`}
        >
          {badgeCount}
        </span>
      )}
      {badgeCount === 0 && hasRunning && (
        <span className="flex h-[6px] w-[6px] shrink-0 animate-pulse rounded-full bg-white/30" title="Running" />
      )}
    </div>
  );
}
