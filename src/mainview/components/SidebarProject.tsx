import { ChevronRight } from "lucide-react";

interface SidebarProjectProps {
  name: string;
  active: boolean;
  badgeCount: number;
  badgeColor: "red" | "green" | "orange";
  onClick: () => void;
}

const BADGE_BG: Record<string, string> = {
  red: "bg-red-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
};

export default function SidebarProject({ name, active, badgeCount, badgeColor, onClick }: SidebarProjectProps) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left ${
        active ? "clide-active-row" : "hover:bg-white/[0.03]"
      }`}
    >
      <ChevronRight size={18} className={active ? "text-white" : "text-white/40"} />
      <span className={`flex-1 truncate text-[14px] ${active ? "font-bold text-white" : "text-white/60"}`}>{name}</span>
      {badgeCount > 0 && (
        <span
          className={`flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-1 text-[11px] font-bold text-white ${BADGE_BG[badgeColor]}`}
        >
          {badgeCount}
        </span>
      )}
    </button>
  );
}
