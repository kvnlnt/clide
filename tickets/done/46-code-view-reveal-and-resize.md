# Ticket 46 — Code View: Reveal in Finder & Resizable Output

## Goal

The script code view inside a run card
([CodeOutput.tsx](../src/mainview/components/output/CodeOutput.tsx) via the
Code tab) has a toolbar with a copy button and an expand chevron
([OutputToolbar.tsx](../src/mainview/components/output/OutputToolbar.tsx)) —
and neither works for the user. Beyond fixing: copy is the wrong affordance
for a script that lives on disk — replace it with **reveal in file system**.
The chevron is an awkward answer to overflow — remove it and make the
output box **vertically resizable** instead.

## Acceptance criteria

### 1. Code view: copy → reveal

- The copy button in `CodeOutput` is replaced by a reveal button
  (`FolderOpen` icon, "Reveal in Finder") that opens the form's folder on
  disk — the component has `formSlug`; get `projectPath` from
  `formsBySlug` in context and call the existing `api.openFolder` on
  `<projectPath>/forms/<slug>` (or add a file-reveal RPC that selects
  `script.<ext>` itself if that's cheap on the Bun side — nicer, optional).
- While investigating, figure out why the old buttons appeared dead:
  `navigator.clipboard` may be unavailable/ungranted in the Electrobun
  webview. If so, note it — [OutputBlock.tsx](../src/mainview/components/output/OutputBlock.tsx)
  still offers copy for text results, and a broken copy there should either
  be fixed (clipboard RPC through the Bun side) or removed. Don't leave a
  silently dead button behind.

### 2. Chevron → resizable box

- The expand/collapse chevron and the `expanded` state are removed from
  `OutputToolbar` and its consumers (`CodeOutput`, `OutputBlock`).
- The scrollable content area becomes user-resizable vertically: CSS
  `resize-y` on the container (with `overflow-auto`, sensible
  `min-height`/`max-height`) or a slim drag handle at the bottom edge if
  `resize-y` renders poorly in the webview. Default height stays ~400px.
- This applies to both the code view and the results output blocks — same
  toolbar, same treatment, so the fix covers everywhere the awkward chevron
  appears.

## Files to modify

- `src/mainview/components/output/CodeOutput.tsx`
- `src/mainview/components/output/OutputToolbar.tsx`
- `src/mainview/components/output/OutputBlock.tsx`
- `src/shared/types.ts` + `src/bun/index.ts` (only if adding file-reveal or
  clipboard RPCs)

## Edge cases

- Resize should not fight the thread's own scroll — resizing the box grows
  the card; the inner area scrolls only when content exceeds the chosen
  height.
- A resized height need not persist across expand/collapse of the card;
  resetting to the default is fine.
- Reveal with a missing form folder (form deleted underneath) fails quietly
  with a small inline error, not a crash.
