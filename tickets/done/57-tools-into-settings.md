# Ticket 57 — Tools Management Moves into Settings

## Goal

Ticket 53 landed the Tools page as a project-toolbar surface, but tool
management is machine-global (the registry lives in `~/.clide`-level app
data, not in any project) — it belongs with the other global configuration.
Remove the **Tools** button from the project toolbar and move the tools
manager into the **Settings** overlay, as a section below **AI Services**.

## Acceptance criteria

- The Tools button is gone from
  [ProjectToolbar.tsx](../src/mainview/components/ProjectToolbar.tsx), and
  `"tools"` is removed from the `ProjectSurface` union
  ([AppContext.tsx](../src/mainview/context/AppContext.tsx)) and its render
  branch in [App.tsx](../src/mainview/App.tsx).
- [SettingsPanel.tsx](../src/mainview/components/SettingsPanel.tsx) gains a
  **Tools** section directly below the AI Services section, with the same
  section-header styling (`text-[12px] font-bold uppercase … text-white/40`).
- The section carries over everything
  [ToolsPage.tsx](../src/mainview/components/ToolsPage.tsx) does today:
  list/expand entries (spec, raw help), resolve & inspect with the consent
  gate, re-inspect, paste-help distillation, rename/remove, and the
  drag-and-drop registration zone (ticket 55). Restructure the component as
  needed to fit Settings' single-scroll layout — a full-page header inside a
  section is wrong; a section heading + content is right.
- `ToolsPage.tsx` is deleted or reduced to the embedded section component —
  no dead surface left behind.

## Files to modify

- `src/mainview/components/SettingsPanel.tsx`
- `src/mainview/components/ToolsPage.tsx` (rework into a section, or replace
  with e.g. `ToolsSection.tsx`)
- `src/mainview/components/ProjectToolbar.tsx`
- `src/mainview/context/AppContext.tsx`, `src/mainview/App.tsx`

## Edge cases

- Settings opens as a full-window overlay with no project active (from the
  Welcome screen) — the Tools section must work there too; nothing in it may
  assume an `activeProject`.
- A drop while the consent sheet for a previous drop is open still queues
  (existing ToolsPage queue behavior carries over).
- The wizard's Find-the-tool step (ticket 54/60) keeps working — it reads
  the same registry over RPC and is unaffected by where management lives.

## Note

Part of the wizard/tools cleanup batch (57–63). Lands independently of the
wizard tickets.
