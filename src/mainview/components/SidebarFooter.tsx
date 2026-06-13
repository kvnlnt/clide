import { Ellipsis, Headphones } from "lucide-react";

export default function SidebarFooter() {
  return (
    <div className="flex items-center justify-between px-2 py-3">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[12px] font-bold text-white/80">
          CL
        </span>
      </div>
      <div className="flex items-center gap-3 text-white/40">
        <button className="transition-colors hover:text-white">
          <Headphones size={18} />
        </button>
        <button className="transition-colors hover:text-white">
          <Ellipsis size={18} />
        </button>
      </div>
    </div>
  );
}
