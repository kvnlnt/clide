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

| #   | Ticket                                | Description                                                                            | Status        |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------- | ------------- |
| 01  | App Shell                             | Electrobun window, IPC bridge, dev/prod config                                         | ✅ Done       |
| 02  | Data Layer                            | Filesystem watcher, form loader, run history SQLite                                    | ✅ Done       |
| 03  | Sidebar                               | Project nav, form lists, badge counts                                                  | ✅ Done       |
| 04  | Top Bar                               | Breadcrumb, command input, view toggles                                                | ✅ Done       |
| 05  | Form Card                             | Expanded/collapsed form component, all states                                          | ✅ Done       |
| 06  | Thread                                | Main scrollable thread, grouping, ordering                                             | ✅ Done       |
| 07  | Execution Engine                      | Script runner, streaming output, status FSM                                            | ✅ Done       |
| 08  | Output Components                     | Table, image, audio/video, raw text viewers                                            | ✅ Done       |
| 09  | Form Selector                         | Autocomplete command palette for picking forms                                         | ✅ Done       |
| 10  | New Form Creator                      | AI-powered form + script generation flow                                               | ✅ Done       |
| 11  | Pin & Schedule                        | Pin forms, scheduled runs, alarm states                                                | ✅ Done       |
| 12  | Grid View                             | Customizable grid layout alternative to thread                                         | ✅ Done       |
| 13  | Grouped Submissions                   | Combine consecutive same-form runs into one card with accordion                        | ✅ Done       |
| 14  | Project Dir Picker                    | Native directory chooser for project creation folder path                              | ✅ Done       |
| 15  | Marketing Website                     | Auto-generate a basic static site into www/ via a script                               | ✅ Done       |
| 16  | Project Mgmt Cleanup                  | New-vs-existing folder choice, picker-only path, safer delete, show folder             | ✅ Done       |
| 17  | Projects Live Anywhere                | Folder-picker-only creation, show picked path, required fields + Create enablement     | ✅ Done       |
| 18  | Project Settings Tabs & Forms Manager | Superseded by ticket 21 — forms CRUD now lives in the unified Forms panel (⌘P)         | ❌ Superseded |
| 19  | Views: Thread Filter Tabs             | Browser-style view tabs in the header; saved per-project filters over the thread       | ✅ Done       |
| 20  | Remove List/Grid Toggle               | Retire the grid view toggle; thread becomes the only presentation for now              | ✅ Done       |
| 21  | Header Settings & Forms CRUD          | Settings button moves to header; remove header search gesture; unified forms CRUD flow | ✅ Done       |
| 22  | Spec-First Form Creation              | 3-box describe step → AI-drafted editable spec (inputs, procedure, outputs, events)    | ✅ Done       |
| 23  | Internal Event Bus                    | Runs emit events on success; listening forms auto-submit with payload; cycle guard     | ✅ Done       |
| 24  | Magic Fields Auto-Fill                | AI fills magic fields on form open and from event payloads; always user-editable       | ✅ Done       |
| 25  | Project Title Tab & Menu              | "All" tab shows active project name; project Forms/Settings menu moves onto it         | ✅ Done       |
| 26  | Forms & Settings as Tabs              | Forms/Settings/Project-Settings become closeable panel tabs instead of modals          | ✅ Done       |
| 27  | View-Scoped Pinning                   | Pinned float/bucket only inside saved views; title tab stays chronological             | ✅ Done       |
| 28  | View Management & Form Picker         | Restart persistence, hide/pin/sort views via manager popover, searchable form picker   | ✅ Done       |
| 29  | Welcome Screen                        | Branded no-project landing: create/open/recent projects, staggered entrance animation  | ✅ Done       |
| 30  | Unified View Editor                   | Merge tab menu + filter popover into one editor: modal for edits, tab body for new     | ✅ Done       |
| 31  | Forms Surfaces as Page Content        | Forms panel & new-form creator render as tab page content, not modal-style cards       | ✅ Done       |
| 32  | Project Tab Cluster & Home Placement  | Project + panel tabs group together with distinct styling; House moves left of title   | ✅ Done       |
| 33  | Settings as Full-Page Screen          | Settings fills the pane edge-to-edge with a single top-right × as the only exit        | ✅ Done       |
| 34  | Project Tab Toolbar                   | Replace project tab dropdown & panel-tab chips with a toolbar fused to the active tab   | ✅ Done       |
| 35  | View Tab Toolbar                      | View settings modal becomes live-apply toolbar controls under the active view tab       | ✅ Done       |
| 36  | Compact View Toolbar Controls         | Forms/status/keyword filters become summary-collapsed multiselect dropdowns; AND/OR     | ✅ Done       |
| 37  | Settings Full-Window Overlay          | App settings covers the entire window including the header/tab strip                    | ✅ Done       |
| 38  | Add Project Modal Full-Window         | New-project modal backdrop dims the whole app, not just the body pane                   | ✅ Done       |
| 39  | Project Surfaces as Pages             | Forms, project Settings & new Views surfaces become full-width, well-designed pages     | ✅ Done       |
