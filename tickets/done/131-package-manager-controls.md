# Ticket 131 — Package Managers: Enable/Disable, Preferred, Drag Reorder

## Goal

Detected package managers become controllable: turn off the ones you
don't use, mark (or order) a preferred one, and reorder by drag-and-drop
instead of up/down arrow buttons.

## Acceptance criteria

### 1. Enable/disable

- [PackageManagersSection.tsx](../src/mainview/components/PackageManagersSection.tsx)'s
  enabled/disabled state — currently display-only text — becomes a real
  toggle, persisted through the existing package-manager registry, and
  disabled managers are excluded from catalog search / install flows
  (ticket 103's machinery).

### 2. Preference

- The list order *is* the preference order (top = preferred), and
  whatever consumes package managers for installs respects it. If a
  single explicit "preferred" marker reads better in the UI than
  implicit ordering, a star on one row is acceptable — pick one
  mechanism, not both.

### 3. Drag-and-drop reorder

- The `move(index, dir)` arrow buttons are replaced by drag-and-drop row
  reordering (HTML drag events or pointer-based; keep it
  dependency-free if reasonable), with the same persistence as today.
  Keyboard accessibility for reordering is preserved in some form
  (e.g. arrows remain as a hidden/secondary affordance or focus+arrow
  keys).

## Files to modify

- `src/mainview/components/PackageManagersSection.tsx`
- The package-manager registry/store on the bun side (persisted
  `enabled` + order), plus catalog/install call sites that must respect
  `enabled` and order
