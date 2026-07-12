# Ticket 70 — Keyboard Shortcuts for Calendar, Views & Settings Surfaces

*(Documented retroactively — implemented on request alongside tickets 64-69.)*

## Goal

⌘P jumped to Forms, but the other project-toolbar surfaces had no keyboard
route. Add shortcuts to jump to Calendar, Views, and (project) Settings.

## What was done

- [App.tsx](../../src/mainview/App.tsx) keyboard handler:
  - **⌘P** Forms (existing), **⌘⇧C** Calendar, **⌘⇧V** Views, **⌘,**
    project Settings. Shift-modified C/V so plain copy/paste are untouched;
    comma follows the platform settings convention.
  - All four **toggle** exactly like their toolbar buttons — press again to
    return to the thread.
  - Fixed a pre-existing quirk: ⌘P used to fire before the
    overlay/active-project guard, switching surfaces underneath open
    overlays. All surface shortcuts now share the same guard as the other
    keyboard commands.
- [ProjectToolbar.tsx](../../src/mainview/components/ProjectToolbar.tsx)
  buttons got `(⌘…)` tooltips matching the Run button's `(⌘K)` convention.
