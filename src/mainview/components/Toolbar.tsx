import type { ReactNode } from "react";

/**
 * Shared shell for tab-fused toolbars: the project title tab's Forms/Settings
 * controls and a view tab's filter controls both render inside this. Same
 * surface color as the active tab it sits under so tab + toolbar read as one
 * continuous piece
 */
export default function Toolbar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex shrink-0 flex-wrap items-center gap-1.5 rounded-lg bg-clide-bg px-3 py-2 ${className}`}>
      {children}
    </div>
  );
}
