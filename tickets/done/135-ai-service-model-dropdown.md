# Ticket 135 — AI Service Editor: Model Dropdown

## Goal

Registering or editing an AI service offers the service's available
models in a dropdown instead of a free-text "Model override" field.

## Acceptance criteria

- The `AIServiceEditor` in
  [SettingsPanel.tsx](../src/mainview/components/SettingsPanel.tsx)
  replaces the free-text model input with the existing
  [ServiceModelPicker.tsx](../src/mainview/components/ServiceModelPicker.tsx)
  (already fed by `api.listServiceModels`, already wired into
  [ToolsSection.tsx](../src/mainview/components/ToolsSection.tsx)) —
  reuse, don't rebuild.
- Model listing works at *registration* time too, before the service is
  saved: once kind + base URL + credential are entered, the picker can
  fetch models (or offer a "load models" action). If the service isn't
  reachable yet, a free-text fallback remains so the user is never
  blocked.
- The picked model persists exactly as the free-text field did
  (`AIService` default-model field) — no type changes expected.

## Files to modify

- `src/mainview/components/SettingsPanel.tsx` (`AIServiceEditor`)
- `src/mainview/components/ServiceModelPicker.tsx` only if it needs a
  prop for the unsaved-service case (kind/baseURL/credential passed
  directly)
