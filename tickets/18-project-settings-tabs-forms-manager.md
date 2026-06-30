# Ticket 18 — Project Settings Tabs & Forms Manager

## Goal

Reorganize the **Project settings** modal into **tabs** so its sections stay
orderly as settings grow, and add a new **Forms** tab that acts as a per-project
**forms manager** — a place to see every form in the project and manage it
(rename, edit details, delete) from one screen.

Two concrete deliverables:

1. **Tabbed modal** — split the existing single-body modal into a left/top tab
   layout with at least **General** and **Forms** tabs.
2. **Forms manager** — under the **Forms** tab, list the project's forms with the
   ability to delete a form (with confirmation) and reveal/open its folder, plus
   inline metadata (name, description, slug, interpreter, updated date).

## Background

- The modal is [ProjectSettingsModal.tsx](../src/mainview/components/ProjectSettingsModal.tsx).
  Today its body stacks three sections in one column: **Name** (rename),
  **Folder** (read-only path + Reveal in Finder), and a **danger zone** delete
  flow. The header reads "Project settings"; a footer has Cancel / Save (Save =
  rename via `renameProject`). It is opened from the sidebar
  ([Sidebar.tsx](../src/mainview/components/Sidebar.tsx)) with `path` + `name`
  props.
- Forms are loaded via `listForms()` → `FormFolder[]`
  ([rpc.ts](../src/mainview/rpc.ts), [types.ts](../src/shared/types.ts) L67).
  Each `FormFolder` carries `meta` (`name`, `slug`, `description`, `project`,
  `tags`, `interpreter`, `createdAt`, `updatedAt`) and `projectPath` (the
  absolute folder of the owning project). The renderer already keeps `forms` in
  [AppContext.tsx](../src/mainview/context/AppContext.tsx) with a live
  `onFormsChanged` subscription, exposed as `refreshForms`.
- A form lives on disk at `<projectPath>/forms/<slug>/`
  ([paths.ts](../src/bun/paths.ts) — `projectFormsDir`, `formDir`). Forms are
  scanned by [forms/loader.ts](../src/bun/forms/loader.ts) and written by
  [forms/writer.ts](../src/bun/forms/writer.ts).
- **There is no `deleteForm` capability today** — forms can be created
  (`createForm`) but never removed from the UI. The forms manager introduces it.
- `openFolder(path)` RPC already exists ([index.ts](../src/bun/index.ts), added in
  ticket 16) and is used by the modal's Reveal button.

## Acceptance criteria

### 1. Tabbed Project settings modal

- The modal presents a **tab bar** (vertical rail on the left, or a horizontal
  strip under the header — implementer's choice, styled to match the dark surface
  language). Tabs:
  - **General** — the current Name / Folder / Delete-project content, unchanged in
    behavior.
  - **Forms** — the new forms manager (see #2).
- The active tab is highlighted; switching tabs swaps the body without closing the
  modal. **General** is selected by default on open.
- The modal grows to comfortably fit a scrollable forms list (e.g. widen toward
  ~560–620px and cap body height with internal scroll) without the whole dialog
  overflowing the viewport.
- Footer behavior stays sensible per tab: **Save** applies the General-tab rename
  as today. The Forms tab's destructive actions are self-contained (each row has
  its own confirm), so Save need not gate them; Cancel/close always works.
- Escape and backdrop click still close the modal; `onClose` is unchanged.
- The structure should make adding a third tab later (e.g. **Scheduling**,
  **AI**) trivial — keep tab definitions data-driven rather than hard-branched
  copy/paste.

### 2. Forms tab — per-project forms manager

- Lists every form whose `meta.project` matches this project (filter
  `listForms()` / `forms` by project; match the project identity already used
  elsewhere — by `projectPath` against the modal's `path`, falling back to
  `meta.project` name match if that is how forms are keyed).
- Each row shows: form **name** (emphasized), **description** (muted, truncated),
  and small meta (slug, `interpreter` if present, and "updated" date from
  `updatedAt`). Match the existing meta type scale (`text-[11px]`/`text-[12px]`,
  `text-white/40`–`/70`).
- Per-row actions:
  - **Reveal folder** — opens `<projectPath>/forms/<slug>/` via the existing
    `openFolder` RPC (`FolderOpen` Lucide icon).
  - **Delete form** — a `Trash2` action that asks for inline confirmation (same
    pattern as the project delete: a confirm/cancel inline state, not a browser
    `confirm()`), then calls a new `deleteForm` RPC and refreshes the list.
- **Empty state**: when the project has no forms, show a friendly message (e.g.
  "No forms yet — create one from the command bar") rather than a blank panel.
- After a delete, the row disappears (driven by the live `onFormsChanged`
  subscription / `refreshForms`); no full-modal reload required.
- The list is the read surface only for now — **rename / edit form details is a
  stretch goal** (see Out of scope), not required to ship this ticket.

## Data / API changes

A new RPC to delete a single form folder from disk:

```ts
// shared/types.ts — within ClideRPC.bun requests
deleteForm: {
  params: { projectPath: string; slug: string };
  response: { ok: boolean; error?: string };
};
```

```ts
// bun/index.ts handler
deleteForm: async ({ projectPath, slug }) => {
  try {
    const dir = formDir(projectPath, slug); // from ./paths
    // guard: ensure resolved dir is inside the project's forms dir before rm
    rmSync(dir, { recursive: true, force: true });
    await pushFormsChanged(); // re-scan + broadcast onFormsChanged
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
},
```

```ts
// mainview/rpc.ts
async deleteForm(projectPath: string, slug: string): Promise<{ ok: boolean; error?: string }> {
  const r = request();
  if (!r) return { ok: false, error: "RPC unavailable" };
  try {
    return await r.deleteForm({ projectPath, slug });
  } catch (e) {
    return { ok: false, error: String(e) };
  }
},
```

- Optionally surface `deleteForm` through `AppContext` (e.g. a `deleteForm`
  callback that calls `api.deleteForm` then `refreshForms`) so the modal stays
  thin and consistent with `deleteProject` / `deleteRun`.
- No change to `listForms`, `renameProject`, or `removeProject` signatures.

## UI spec

- **Tab bar**: reuse the modal's existing color tokens (`bg-clide-panel`,
  `border-clide-border`, `bg-clide-surface`); active tab = full-opacity white
  label with a subtle indicator (left border / underline / pill), inactive =
  `text-white/50` with hover. Tab labels at `text-[12px]–[13px]`.
- **Forms list**: vertical stack of rows separated by `border-white/5`, each row
  `px-2.5 py-2`, hover `bg-white/5`, `rounded-md`. Row actions sit on the right,
  appearing on hover or always-visible (match the form card menu affordance
  style). Confirm state for delete reuses the General tab's inline red
  `Remove`/`Cancel` button pattern and copy ("Delete form "{name}"? Files on disk
  are removed.").
- **Empty state**: centered muted text + optional icon inside the Forms body
  area.

## Files to modify

- `src/shared/types.ts` — add `deleteForm` to the RPC schema.
- `src/bun/index.ts` — add `deleteForm` handler (import `formDir` from `./paths`,
  `rmSync` from `node:fs`; reuse `pushFormsChanged`). Guard the resolved path.
- `src/mainview/rpc.ts` — add typed `deleteForm` wrapper.
- `src/mainview/context/AppContext.tsx` — (optional) expose a `deleteForm`
  helper that delegates to `api.deleteForm` + `refreshForms`.
- `src/mainview/components/ProjectSettingsModal.tsx` — introduce tab state and a
  data-driven tab list; move existing body into a **General** panel; add the
  **Forms** panel.
- `src/mainview/components/ProjectFormsManager.tsx` — **new** component rendering
  the per-project forms list + per-row delete/reveal (keeps the modal file from
  ballooning).

## Edge cases

- **Delete the form currently open as a draft/card in the thread**: removing the
  folder is fine; the existing watcher/`onFormsChanged` flow already reconciles
  the form list. Drafts referencing a deleted slug should fail gracefully (no
  crash); verify the thread doesn't throw on a missing `formsBySlug` entry.
- **Path traversal / bad slug**: the handler must confirm the resolved `formDir`
  is inside the project's `forms` dir before `rmSync` — never delete outside it.
- **`deleteForm` fails (permissions, missing dir)**: wrapper returns
  `{ ok: false }`; show a subtle inline error on the row, leave it in place.
- **Project with many forms**: list scrolls internally; modal height stays
  capped.
- **RPC unavailable in HMR**: forms list still renders from the in-memory
  `forms`; delete is a no-op that surfaces "RPC unavailable" rather than throwing.
- **Tab with no content yet** (future tabs): not a concern now — only General and
  Forms ship.

## Out of scope / stretch

- **Edit form details / rename a form** from the manager (name, description,
  tags, interpreter, or editing the script). Recommended as the next ticket once
  the read + delete surface lands; would need a `renameForm` / `updateFormMeta`
  RPC and likely an inline editor or a dedicated sub-view.
- Bulk selection / multi-delete of forms.
- Moving a form between projects.
- Additional settings tabs (**Scheduling**, **AI provider**, **Layout**) — the
  tab structure should make these easy to add later, but none ship here.
- Drag-to-reorder forms.
