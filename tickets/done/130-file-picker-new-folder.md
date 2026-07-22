# Ticket 130 — "Create New Folder" in the Directory Picker

## Goal

Adding a file location (or picking any directory) no longer forces a
round-trip to Finder when the target folder doesn't exist yet — the
picker flow can create one.

## Acceptance criteria

- The `chooseDirectory` RPC in [index.ts](../src/bun/index.ts) (wrapping
  Electrobun's native `Utils.openFileDialog`) enables folder creation if
  the native dialog supports a can-create-directories option; verify
  what Electrobun exposes.
- If the native dialog cannot offer it, the calling flows get an
  in-app fallback: after (or alongside) picking a parent directory, a
  small "New folder" affordance creates a named subfolder (mkdir via a
  small RPC) and selects it.
- All three call sites benefit without per-site duplication:
  [FilesPage.tsx](../src/mainview/components/files/FilesPage.tsx),
  [NewProjectModal.tsx](../src/mainview/components/NewProjectModal.tsx),
  [WelcomeScreen.tsx](../src/mainview/components/WelcomeScreen.tsx).

## Files to modify

- `src/bun/index.ts` (dialog options; possible `createDirectory` RPC),
  `src/shared/types.ts`, `src/mainview/rpc.ts`
- `src/mainview/components/files/FilesPage.tsx`,
  `NewProjectModal.tsx`, `WelcomeScreen.tsx` (only if the fallback UI
  is needed)
