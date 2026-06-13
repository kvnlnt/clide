# Ticket 05 — Form Card Component

## Goal
Build the core `FormCard` component — the central UI primitive of CLIDE. It renders a form in expanded or collapsed state and cycles through all execution states.

## Acceptance criteria
- FormCard renders in **expanded** mode when first added to the thread
- FormCard renders in **collapsed** mode for completed/historical runs in the thread
- All five execution states are visually distinct (see State FSM below)
- Collapsed card shows: status icon, form name, summary text (first field value or AI prompt), timestamp, ellipsis menu
- Expanded card shows: form name, optional AI prompt field, all form fields, footer with SEND button and network/status info
- Clicking a collapsed card expands it (shows previous values, read-only if completed)
- SEND button is disabled until all required fields are filled
- Form fields support all types from ticket 02: `text`, `textarea`, `select`, `multicheck`, `number`, `file`, `date`

## State FSM
```
idle → running → success
                └→ error
idle → scheduled (pinned with a scheduled time)
```

| State | Icon | Visual treatment |
|-------|------|-----------------|
| `idle` | — | Normal, fields editable, SEND enabled |
| `running` | spinner | Fields locked, SEND replaced with "Cancel", subtle pulse on border |
| `success` | green check | Collapsed by default, green check icon, output rendered below in thread |
| `error` | red X | Collapsed with red icon, error message in summary |
| `scheduled` | alarm-clock | Collapsed, shows scheduled time, alarm-clock icon |

## Visual spec (from Figma)

### Expanded card
- Background: `#0a0a0a`, border: `1px solid #3d3c3c`, border-radius: `5px`
- Header row: form name (12px white) + AI prompt text field (italic 12px 30% white placeholder `✦ Describe your post...`) + right icons (open-external, undo, ellipsis)
- Separator line below header
- Field sections: field label (14px bold 70% white) above each field or inline
- Textarea background: `rgba(217,217,217,0.05)`, no border, 4px radius, full width
- Checkbox group: small rounded squares `rgba(217,217,217,0.2)`, label beside each
- Footer: left side = network/status icon, right side = SEND button
- SEND button: `#222121` bg, `1px solid rgba(255,255,255,0.05)` border, `3px` radius, "SEND" 12px bold 70% white, chevron-right icon, vertical divider before chevron

### Collapsed card
- No background fill (sits in thread as a row)
- Left: status icon (20px), form name (16px 60% white), summary text (14px `#575757`)
- Right: timestamp (12px 40% white), ellipsis icon
- Pin icon replaces status icon when pinned

## Component structure
```
FormCard
  FormCardHeader      (name + AI prompt + header icons)
  FormCardBody        (fields — only in expanded)
    FormField         (renders correct input type per field.type)
  FormCardFooter      (status + SEND — only in expanded)
  FormCardCollapsed   (single-row summary — only in collapsed)
```

## Props
```ts
interface FormCardProps {
  run: RunRecord         // id, formSlug, inputs, status, timestamps
  form: FormDefinition   // fields, aiPromptField, outputType
  meta: FormMeta         // name, project
  defaultExpanded?: boolean
  onSubmit: (values: Record<string, unknown>) => void
  onCancel: () => void
}
```

## Files to create
- `src/mainview/components/FormCard.tsx`
- `src/mainview/components/FormCardHeader.tsx`
- `src/mainview/components/FormCardBody.tsx`
- `src/mainview/components/FormCardFooter.tsx`
- `src/mainview/components/FormCardCollapsed.tsx`
- `src/mainview/components/FormField.tsx`
- `src/mainview/types/forms.ts` — shared TypeScript types
