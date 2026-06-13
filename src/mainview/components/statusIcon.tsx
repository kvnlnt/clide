import { AlarmClock, Check, Loader, Pin, X } from "lucide-react";
import type { RunStatus } from "../types/forms";

interface StatusIconProps {
  status: RunStatus;
  pinned?: boolean;
  size?: number;
}

export default function StatusIcon({ status, pinned, size = 18 }: StatusIconProps) {
  if (pinned) return <Pin size={size} className="text-white/60" />;
  switch (status) {
    case "running":
    case "pending":
      return <Loader size={size} className="animate-spin text-white/60" />;
    case "success":
      return <Check size={size} className="text-green-400" />;
    case "error":
      return <X size={size} className="text-red-400" />;
    case "scheduled":
      return <AlarmClock size={size} className="text-orange-400" />;
    default:
      return <span style={{ width: size, height: size }} className="inline-block" />;
  }
}
