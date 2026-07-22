import { useCallback } from "react";
import { api } from "../rpc";
import { useUIFeedback } from "../components/UIFeedback";

const basename = (p: string) => p.split("/").filter(Boolean).pop() ?? p;

/**
 * Wraps `api.chooseDirectory` with an in-app "New folder" fallback (ticket
 * 130): Electrobun's native dialog has no can-create-directories option, so
 * after a parent folder is picked this offers to mkdir a named subfolder and
 * selects that instead. Leaving the name blank (or dismissing) just uses the
 * picked folder — the single shared spot so FilesPage, NewProjectModal, and
 * WelcomeScreen don't each reimplement it.
 */
export function useDirectoryPicker() {
  const { prompt, toast } = useUIFeedback();

  return useCallback(
    async (startingFolder?: string): Promise<string | null> => {
      const picked = await api.chooseDirectory(startingFolder);
      if (!picked) return null;

      const name = await prompt({
        title: "New folder?",
        message: `Optional — inside "${basename(picked)}". Leave blank to use this folder.`,
        placeholder: "Folder name",
        confirmLabel: "Create",
        cancelLabel: "Use this folder",
      });
      if (!name?.trim()) return picked;

      const res = await api.createDirectory(picked, name.trim());
      if (!res.ok || !res.path) {
        toast(res.error ?? "Failed to create folder", "error");
        return picked;
      }
      return res.path;
    },
    [prompt, toast],
  );
}
