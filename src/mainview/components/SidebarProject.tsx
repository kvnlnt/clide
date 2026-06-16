import { Settings } from "lucide-react";

interface SidebarProjectProps {
  name: string;
  active: boolean;
  badgeCount: number;
  badgeColor: "red" | "green" | "orange";
  canEdit: boolean;
  onClick: () => void;
  onOpenSettings: () => void;
}

const BADGE_BG: Record<string, string> = {
  red: "bg-red-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
};

export default function SidebarProject({
  name,
  active,
  badgeCount,
  badgeColor,
  canEdit,
  onClick,
  onOpenSettings,
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
      {canEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenSettings();
          }}
          title="Project settings"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-white/30 opacity-0 hover:bg-white/10 hover:text-white group-hover:opacity-100"
        >
          <Settings size={14} />
        </button>
      )}
    </div>
  );
}
