import { watch, type FSWatcher } from "node:fs";
import { ensureProjectDirs, projectFormsDir } from "../paths";

/**
 * Watch each project's tasks directory for additions/removals and invoke
 * `onChange` (debounced) whenever the set of task folders may have changed.
 * Note: disk directory still named "forms" per the disk format firewall.
 */
export function watchTasks(projectPaths: string[], onChange: () => void, debounceMs = 300): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const watchers: FSWatcher[] = [];

  const trigger = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, debounceMs);
  };

  for (const projectPath of projectPaths) {
    ensureProjectDirs(projectPath);
    try {
      watchers.push(watch(projectFormsDir(projectPath), { recursive: true }, () => trigger()));
    } catch (err) {
      console.warn(`[tasks] Failed to watch ${projectPath}:`, err);
    }
  }

  return () => {
    if (timer) clearTimeout(timer);
    for (const w of watchers) w.close();
  };
}
