# CLIDE — Ticket Overview

CLIDE is a desktop CLI Development Environment built with Electrobun + React + Tailwind.
The core metaphor: everything is a form. Scripts are wrapped in forms. Results appear inline.
The user never thinks about shell commands — they think about filling out forms.

## Stack

- **Runtime**: Electrobun (Bun-backed native desktop, macOS-first)
- **UI**: React 18 + Tailwind CSS v3 + Vite HMR
- **Storage**: Flat files on disk for forms/scripts; SQLite (bun:sqlite) for run history only
- **AI**: User-selectable provider (Claude / OpenAI / Ollama) — provider and API key chosen by user in the New Form Creator; credentials stored in system keychain
- **Shell execution**: Bun `Subprocess` in the main process, results streamed to renderer via Electrobun RPC

## Form storage layout

Each form/script set is a self-contained folder:

```
~/.clide/forms/<form-slug>/
  script.sh       # the shell script (or .py, .js, etc.)
  form.json       # field definitions, labels, input→arg mapping, output type
  meta.json       # name, description, tags, project, created/updated dates
```

Each form belongs to exactly one **project**, recorded as a `project` field in `meta.json`. The left sidebar is project navigation — projects are just the distinct `project` values across all form folders. No separate folder hierarchy required.

## Visual language (from Figma)

- Background: `#141414`, surface cards: `#0a0a0a` / `#222121`
- Border: `#3d3c3c`
- Text: white at varying opacities (100% active, 70% sub-label, 60% secondary, 40% meta, 30% placeholder)
- Font: Inter
- Accent: small colored notification badges (red/green/orange dots)
- Icons: Lucide icon set
- Command input placeholder: `✦ At your command...` (italic, 30% white)

## Ticket index

Completed implementation tickets are archived in [`tickets/done/`](done/). Open tickets live at the top level of [`tickets/`](.).

| #   | Ticket              | Description                                                     | Status  |
| --- | ------------------- | --------------------------------------------------------------- | ------- |
| 01  | App Shell           | Electrobun window, IPC bridge, dev/prod config                  | ✅ Done |
| 02  | Data Layer          | Filesystem watcher, form loader, run history SQLite             | ✅ Done |
| 03  | Sidebar             | Project nav, form lists, badge counts                           | ✅ Done |
| 04  | Top Bar             | Breadcrumb, command input, view toggles                         | ✅ Done |
| 05  | Form Card           | Expanded/collapsed form component, all states                   | ✅ Done |
| 06  | Thread              | Main scrollable thread, grouping, ordering                      | ✅ Done |
| 07  | Execution Engine    | Script runner, streaming output, status FSM                     | ✅ Done |
| 08  | Output Components   | Table, image, audio/video, raw text viewers                     | ✅ Done |
| 09  | Form Selector       | Autocomplete command palette for picking forms                  | ✅ Done |
| 10  | New Form Creator    | AI-powered form + script generation flow                        | ✅ Done |
| 11  | Pin & Schedule      | Pin forms, scheduled runs, alarm states                         | ✅ Done |
| 12  | Grid View           | Customizable grid layout alternative to thread                  | ✅ Done |
| 13  | Grouped Submissions | Combine consecutive same-form runs into one card with accordion | ✅ Done |
| 14  | Project Dir Picker  | Native directory chooser for project creation folder path       | ✅ Done |
| 15  | Marketing Website   | Auto-generate a basic static site into www/ via a script        | ✅ Done |
