# Ticket 14 — Directory Picker for Project Creation

## Goal

Let users pick (or create) a project folder through a native macOS directory
chooser instead of typing an absolute path by hand. The "New project" form in the
sidebar currently exposes a free-text **Folder path (optional)** input
([Sidebar.tsx](../src/mainview/components/Sidebar.tsx)); this ticket replaces hand-typing
with a **Browse…** action backed by Electrobun's native open-file dialog, while keeping
manual entry as a fallback.

## Background

- Project creation flows from the sidebar form → `createProject`
  ([AppContext.tsx](../src/mainview/context/AppContext.tsx)) → `api.addProject`
  ([rpc.ts](../src/mainview/rpc.ts)) → the `addProject` RPC handler
  ([index.ts](../src/bun/index.ts)) → `addProject` on disk
  ([config.ts](../src/bun/config.ts)).
- `addProject` already accepts an optional absolute `path`, validates that it is
  absolute, and calls `ensureProjectDirs` to create the folder if it does not exist.
  So the backend already supports "select or create a directory" — the gap is purely
  UI: there is no native picker, only a text field.
- Electrobun ships a native dialog in the **main process**:
  `openFileDialog({ canChooseDirectory, canChooseFiles, allowsMultipleSelection, startingFolder })`
  from `electrobun/bun` (`node_modules/electrobun/dist/api/bun/core/Utils.ts`). On macOS
  the standard open panel includes a **New Folder** button, satisfying the
  "or create one" requirement natively.
- The generic form `file` field ([FormField.tsx](../src/mainview/components/FormField.tsx))
  is also just a text input today. This ticket focuses on the project form; extending
  the picker to the generic `file` field is listed as a stretch goal.

## Acceptance criteria

### RPC: native directory picker

- A new RPC request `chooseDirectory` is added to `ClideRPC`
  ([types.ts](../src/shared/types.ts)) with:
  - params: `{ startingFolder?: string }`
  - response: `{ path: string | null }` (null when the user cancels)
- The Bun handler ([index.ts](../src/bun/index.ts)) calls Electrobun's `openFileDialog`
  with `canChooseDirectory: true`, `canChooseFiles: false`,
  `allowsMultipleSelection: false`, and returns the first selected path (or `null` on
  cancel / empty result).
- `rpc.ts` ([rpc.ts](../src/mainview/rpc.ts)) exposes a typed `chooseDirectory(startingFolder?)`
  wrapper.

### Sidebar project form

- The **Folder path (optional)** row gains a **Browse…** button next to the input.
- Clicking **Browse…** opens the native directory dialog. When the user selects a
  folder, its absolute path fills the path input. When the user creates a new folder
  via the dialog's New Folder button and selects it, that new path fills the input.
- Cancelling the dialog leaves the current input value unchanged.
- The text input remains editable so a path can still be typed/pasted manually.
- Pressing **Create** behaves exactly as today: empty path → folder auto-created under
  the default projects dir; non-empty path → that absolute folder is used/created.
- If the chosen/typed path is not absolute, the existing backend error
  ("Project path must be absolute.") surfaces in the form's error line — no new
  client-side validation required, but the error must render.

### Behavior parity

- No change to the auto-create-from-name behavior when no path is provided.
- Selecting an existing already-registered folder returns the existing project (current
  `addProject` dedupe behavior) — surfaced to the user without throwing.

## Data / API changes

```ts
// shared/types.ts — within ClideRPC.bun requests
chooseDirectory: {
  params: { startingFolder?: string };
  response: { path: string | null };
};
```

```ts
// bun/index.ts handler
chooseDirectory: async ({ startingFolder }) => {
  const paths = await openFileDialog({
    startingFolder: startingFolder ?? "~/",
    canChooseDirectory: true,
    canChooseFiles: false,
    allowsMultipleSelection: false,
  });
  const first = paths.find((p) => p.trim().length > 0) ?? null;
  return { path: first };
},
```

```ts
// mainview/rpc.ts
async chooseDirectory(startingFolder?: string): Promise<string | null> {
  const r = getRpc();
  if (!r) return null;
  const res = await r.chooseDirectory({ startingFolder });
  return res.path;
}
```

Note: `openFileDialog` returns a comma-joined string split into an array; an empty
selection can yield `[""]`, so the handler filters blanks before returning.

## UI spec

- **Browse…** button: small, matches the existing sidebar button styling
  (`bg-white/10` hover `bg-white/20`, `text-[12px]`, rounded), placed inline to the
  right of the path input (input `flex-1`, button `shrink-0`).
- Optional folder icon (Lucide `Folder` / `FolderOpen`) inside the button for affordance.
- Disable the button while a dialog request is in flight to prevent double-opening.

## Files to modify

- `src/shared/types.ts` — add `chooseDirectory` to the RPC schema.
- `src/bun/index.ts` — import `openFileDialog` from `electrobun/bun`; add handler.
- `src/mainview/rpc.ts` — add typed `chooseDirectory` wrapper.
- `src/mainview/components/Sidebar.tsx` — add **Browse…** button + wire to the path input.

## Edge cases

- **Cancel**: dialog returns no path → input unchanged, no error.
- **Multiple paths returned**: defensively take the first non-empty entry.
- **Relative `startingFolder`**: default to `~/` when none provided.
- **Dialog unavailable** (e.g. RPC not ready in dev HMR): wrapper returns `null` and the
  button is effectively a no-op; manual entry still works.

## Out of scope / stretch

- Extending the native directory/file picker to the generic form `file` field
  ([FormField.tsx](../src/mainview/components/FormField.tsx)) — track separately.
- Distinguishing "choose existing" vs. "create new" as separate buttons; the native
  panel's New Folder affordance covers creation.
- Project rename relocating the on-disk folder (rename only changes display name today).
