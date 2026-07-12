# Ticket 67 — Form Creation Wizard Takes Over the Whole Window

## Goal

The wizard ([NewFormPage.tsx](../src/mainview/components/NewFormPage.tsx))
renders inside the body pane ([App.tsx](../src/mainview/App.tsx) — the
`newFormOpen ?` branch), so the header/tab strip and sidebar stay visible
around it: it reads as a subpage of the project. Creating a form is a
focused, modal activity — the wizard should **cover the entire window**,
exactly like the Settings overlay (ticket 37), so the user's attention is
100% on the form being built.

## Acceptance criteria

- `newFormOpen` renders as a **top-level full-window overlay** in
  `Workspace`, using the established Settings mechanic
  (`absolute inset-0 z-50 flex flex-col bg-clide-bg` + a minimal drag region
  with `TrafficLights` re-rendered so the window stays movable/closable) —
  not inside the body-pane branch. Tab strip, project toolbar, and sidebar
  are fully covered, not just dimmed.
- The body-pane `newFormOpen ?` branch is removed; whatever surface was
  active before opening the wizard is untouched underneath and intact after
  close/create (the overlay never unmounts the workspace).
- Wizard internals are unchanged: header with `WizardSteps` + ×, scrollable
  body, footer BACK/NEXT/CREATE. Escape and × close as today; keyboard tab
  navigation already treats `newFormOpen` as a blocking overlay
  (`overlayOpen` in App.tsx) — verify that still holds.
- Layering vs. the other overlays is defined: Settings (also z-50) and the
  wizard are mutually exclusive in practice, but opening Settings is
  impossible while the wizard covers its button — no z-fighting states
  reachable.
- Respect the window frame's rounded corners (same as the Settings overlay
  — the opaque layer must not spill square edges over the `rounded-[15px]`
  root).

## Files to modify

- `src/mainview/App.tsx`
- `src/mainview/components/NewFormPage.tsx` (only if its root sizing needs
  a tweak for the new container)

## Edge cases

- Opening the wizard from the Welcome screen (no active project) must work
  identically — the overlay doesn't depend on a project being open.
- The run picker (⌘K) and other global shortcuts stay inert while the
  wizard is open, matching current `overlayOpen` behavior.
- On create, `addFormDraft` still lands the new draft card in the thread
  the user returns to.

## Note

Same mechanic as tickets 37/38 — third consumer of the top-level overlay
slot in `Workspace`.
