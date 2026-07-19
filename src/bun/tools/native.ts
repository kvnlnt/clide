/**
 * Native tool registry (ticket 99): built-in capabilities that appear alongside
 * installed CLI tools when creating a new task. These need no PATH resolution
 * or `--help` capture — they're backed directly by the CLIDE runtime.
 */

import type { NativeTool } from "../../shared/types";

export const NATIVE_TOOLS: NativeTool[] = [
  {
    id: "browser-automation",
    name: "Browser Automation",
    description: "Drive a real browser through recorded or configured steps",
    icon: "🌐",
  },
];

export function listNativeTools(): NativeTool[] {
  return NATIVE_TOOLS;
}
