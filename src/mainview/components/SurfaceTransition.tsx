import type { ReactNode } from "react";

interface SurfaceTransitionProps {
  /** Changing this remounts the wrapper, re-triggering the fade (ticket 121). */
  transitionKey: string;
  children: ReactNode;
  className?: string;
}

/**
 * Shared fade-in used everywhere the body pane's content identity changes:
 * ProjectSurface switches (thread/tasks/views/calendar/files/settings) and
 * view-tab switches in App.tsx. One timing/easing for all of it instead of
 * per-page one-offs. Purely a CSS animation on opacity/transform — never
 * blocks input, so a slow async load inside stays fully interactive.
 */
export default function SurfaceTransition({ transitionKey, children, className }: SurfaceTransitionProps) {
  return (
    <div key={transitionKey} className={`clide-surface-transition ${className ?? ""}`}>
      {children}
    </div>
  );
}
