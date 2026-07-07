import { AlarmClock, Check, Circle, Clock, Loader, X, type LucideIcon } from "lucide-react";
import type { RunStatus } from "../types/forms";

interface StatusMeta {
  label: string;
  icon: LucideIcon;
  /** Icon/dot color in `default` and `dot` mode. */
  textClass: string;
  /** Background + text for badge-style usage (run counts, chips). */
  badgeClass: string;
  spin?: boolean;
}

/**
 * Single source of truth for how each run status looks: icon, color, label.
 * Every status must be visually distinct — no shared colors, no blank icons.
 */
export const STATUS_META: Record<RunStatus, StatusMeta> = {
  idle: {
    label: "Idle",
    icon: Circle,
    textClass: "text-white/40",
    badgeClass: "bg-white/10 text-white/50",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    textClass: "text-sky-300/80",
    badgeClass: "bg-sky-500/15 text-sky-300",
  },
  running: {
    label: "Running",
    icon: Loader,
    textClass: "text-blue-400",
    badgeClass: "bg-blue-500/20 text-blue-400",
    spin: true,
  },
  success: {
    label: "Success",
    icon: Check,
    textClass: "text-green-400",
    badgeClass: "bg-green-500/20 text-green-400",
  },
  error: {
    label: "Error",
    icon: X,
    textClass: "text-red-400",
    badgeClass: "bg-red-500/20 text-red-400",
  },
  scheduled: {
    label: "Scheduled",
    icon: AlarmClock,
    textClass: "text-orange-400",
    badgeClass: "bg-orange-500/20 text-orange-400",
  },
};

/** Stable display order for status badges/chips — running first (most urgent), idle last. */
export const STATUS_ORDER: RunStatus[] = ["running", "pending", "scheduled", "error", "success", "idle"];

interface StatusIconProps {
  status: RunStatus;
  size?: number;
  mode?: "default" | "dot";
}

export default function StatusIcon({ status, size = 18, mode = "default" }: StatusIconProps) {
  const meta = STATUS_META[status];
  if (mode === "dot") {
    return <Circle size={8} fill="currentColor" className={meta.textClass} />;
  }
  const Icon = meta.icon;
  return <Icon size={size} className={`${meta.textClass} ${meta.spin ? "animate-spin" : ""}`} />;
}
