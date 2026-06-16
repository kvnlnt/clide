import { Ellipsis } from "lucide-react";
import { useApp } from "../context/AppContext";

export default function SidebarFooter() {
  const { openSettings } = useApp();
  return (
    <div className="flex items-center justify-between px-2 py-3">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[12px] font-bold text-white/80">
          CL
        </span>
      </div>
      <div className="flex items-center gap-3 text-white/40">
        {/* TODO: <button className="transition-colors hover:text-white">
          <Headphones size={18} />
        </button> */}
        <button
          className="transition-colors hover:text-white"
          onClick={openSettings}
        >
          <Ellipsis size={18} />
        </button>
      </div>
    </div>
  );
}
