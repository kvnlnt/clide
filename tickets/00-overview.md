# CLIDE — Ticket Overview

CLIDE is a desktop CLI Development Environment built with Electrobun + React + Tailwind.
The core metaphor: everything is a task. Scripts are wrapped in tasks. Results appear inline.
The user never thinks about shell commands — they think about filling out tasks.

**Note**: The on-disk storage layout still uses the name "forms" (`<project>/forms/<slug>/form.json`) for backward compatibility. The product calls these "tasks".

## Stack

- **Runtime**: Electrobun (Bun-backed native desktop, macOS-first)
- **UI**: React 18 + Tailwind CSS v3 + Vite HMR
- **Storage**: Flat files on disk for forms/scripts; SQLite (bun:sqlite) for run history only
- **AI**: User-selectable provider (Claude / OpenAI / Ollama) — provider and API key chosen by user in the New Form Creator; credentials stored in system keychain
- **Shell execution**: Bun `Subprocess` in the main process, results streamed to renderer via Electrobun RPC

## Storage layout (on disk)

Each task/script set is a self-contained folder:

```
~/.clide/forms/<form-slug>/
  script.sh       # the shell script (or .py, .js, etc.)
  form.json       # field definitions, labels, input→arg mapping, output type
  meta.json       # name, description, tags, project, created/updated dates
```

Note: The directory and file names still say "form" for backward compatibility, but the product calls these "tasks".

Each task belongs to exactly one **project**, recorded as a `project` field in `meta.json`. The left sidebar is project navigation — projects are just the distinct `project` values across all task folders. No separate folder hierarchy required.

## Visual language

- Background: `#151212` (`clide-bg`). Cards/inputs: `#1c1a1a` (`clide-surface`) — a
  subtle _lift above_ the background, not a darker well. Popovers/panels:
  `#211f1f` (`clide-panel`), lighter still. (Superseded the original Figma's
  darker `#0a0a0a`/`#222121` card fills per ticket 44 — those read as black
  boxes; low contrast reads as part of the page instead.)
- Border: `#2a2828` (`clide-border`) — soft, not a loud outline.
- Text: white at varying opacities (100% active, 70% sub-label, 60% secondary, 40% meta, 30% placeholder)
- Font: Inter
- Accent: small colored notification badges (red/green/orange dots); canonical
  per-status icon/color/label map lives in `statusIcon.tsx` (`STATUS_META`).
- Icons: Lucide icon set
- Command input placeholder: `✦ At your command...` (italic, 30% white)

### Motion (ticket 122)

- **One signature easing**: `cubic-bezier(0.16, 1, 0.3, 1)` — a fast-out,
  gentle-settle curve already used by the ticket-29 welcome entrance and
  the ticket-121 surface transitions. Every new animation reuses it
  (`--clide-ease` in `index.css`) rather than inventing a new curve —
  consistency of *feel* is the whole point of a "signature."
- **Duration bands**, fastest to slowest, matched to how much the eye
  needs to track: micro-interactions (hover/press) 100–150ms; content
  entering/leaving (cards, surface switches) 180–220ms; ambient/looping
  effects (glows, pulses) 1.4–4.5s, always slow enough to read as
  "alive," never "loading."
- **The ✦ mark is the delight motif** — it already appears in the command
  input placeholder; ticket 122 extends it as the visual signature for
  "something just happened" moments (e.g. a run finishing) rather than
  introducing an unrelated new symbol.
- **Status changes get a moment, not a snap** — a run's status badge
  transitions with a brief pulse instead of an instant color swap, cross-
  referencing `STATUS_META`'s existing color language so the animation
  reinforces the palette instead of competing with it.
- **New content entering the thread earns more motion than everyday
  navigation** — a freshly submitted run card entering the thread is a
  bigger moment than switching tabs, so it gets a marginally more
  pronounced entrance than the ticket-121 surface fade, not a different
  vocabulary.
- Every rule above is subordinate to `prefers-reduced-motion` and to
  input responsiveness — motion is `opacity`/`transform` only, never
  something a slow network/AI call can block on.

## Ticket index

Completed implementation tickets are archived in [`tickets/done/`](done/). Open tickets live at the top level of [`tickets/`](.). On-hold tickets sit in [`tickets/hold/`](hold/); raw idea notes in [`tickets/ideas/`](ideas/).

| #   | Ticket                                | Description                                                                                       | Status        |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------- |
| 01  | App Shell                             | Electrobun window, IPC bridge, dev/prod config                                                    | ✅ Done       |
| 02  | Data Layer                            | Filesystem watcher, form loader, run history SQLite                                               | ✅ Done       |
| 03  | Sidebar                               | Project nav, form lists, badge counts                                                             | ✅ Done       |
| 04  | Top Bar                               | Breadcrumb, command input, view toggles                                                           | ✅ Done       |
| 05  | Form Card                             | Expanded/collapsed form component, all states                                                     | ✅ Done       |
| 06  | Thread                                | Main scrollable thread, grouping, ordering                                                        | ✅ Done       |
| 07  | Execution Engine                      | Script runner, streaming output, status FSM                                                       | ✅ Done       |
| 08  | Output Components                     | Table, image, audio/video, raw text viewers                                                       | ✅ Done       |
| 09  | Form Selector                         | Autocomplete command palette for picking forms                                                    | ✅ Done       |
| 10  | New Form Creator                      | AI-powered form + script generation flow                                                          | ✅ Done       |
| 11  | Pin & Schedule                        | Pin forms, scheduled runs, alarm states                                                           | ✅ Done       |
| 12  | Grid View                             | Customizable grid layout alternative to thread                                                    | ✅ Done       |
| 13  | Grouped Submissions                   | Combine consecutive same-form runs into one card with accordion                                   | ✅ Done       |
| 14  | Project Dir Picker                    | Native directory chooser for project creation folder path                                         | ✅ Done       |
| 15  | Marketing Website                     | Auto-generate a basic static site into www/ via a script                                          | ✅ Done       |
| 16  | Project Mgmt Cleanup                  | New-vs-existing folder choice, picker-only path, safer delete, show folder                        | ✅ Done       |
| 17  | Projects Live Anywhere                | Folder-picker-only creation, show picked path, required fields + Create enablement                | ✅ Done       |
| 18  | Project Settings Tabs & Forms Manager | Superseded by ticket 21 — forms CRUD now lives in the unified Forms panel (⌘P)                    | ❌ Superseded |
| 19  | Views: Thread Filter Tabs             | Browser-style view tabs in the header; saved per-project filters over the thread                  | ✅ Done       |
| 20  | Remove List/Grid Toggle               | Retire the grid view toggle; thread becomes the only presentation for now                         | ✅ Done       |
| 21  | Header Settings & Forms CRUD          | Settings button moves to header; remove header search gesture; unified forms CRUD flow            | ✅ Done       |
| 22  | Spec-First Form Creation              | 3-box describe step → AI-drafted editable spec (inputs, procedure, outputs, events)               | ✅ Done       |
| 23  | Internal Event Bus                    | Runs emit events on success; listening forms auto-submit with payload; cycle guard                | ✅ Done       |
| 24  | Magic Fields Auto-Fill                | AI fills magic fields on form open and from event payloads; always user-editable                  | ✅ Done       |
| 25  | Project Title Tab & Menu              | "All" tab shows active project name; project Forms/Settings menu moves onto it                    | ✅ Done       |
| 26  | Forms & Settings as Tabs              | Forms/Settings/Project-Settings become closeable panel tabs instead of modals                     | ✅ Done       |
| 27  | View-Scoped Pinning                   | Pinned float/bucket only inside saved views; title tab stays chronological                        | ✅ Done       |
| 28  | View Management & Form Picker         | Restart persistence, hide/pin/sort views via manager popover, searchable form picker              | ✅ Done       |
| 29  | Welcome Screen                        | Branded no-project landing: create/open/recent projects, staggered entrance animation             | ✅ Done       |
| 30  | Unified View Editor                   | Merge tab menu + filter popover into one editor: modal for edits, tab body for new                | ✅ Done       |
| 31  | Forms Surfaces as Page Content        | Forms panel & new-form creator render as tab page content, not modal-style cards                  | ✅ Done       |
| 32  | Project Tab Cluster & Home Placement  | Project + panel tabs group together with distinct styling; House moves left of title              | ✅ Done       |
| 33  | Settings as Full-Page Screen          | Settings fills the pane edge-to-edge with a single top-right × as the only exit                   | ✅ Done       |
| 34  | Project Tab Toolbar                   | Replace project tab dropdown & panel-tab chips with a toolbar fused to the active tab             | ✅ Done       |
| 35  | View Tab Toolbar                      | View settings modal becomes live-apply toolbar controls under the active view tab                 | ✅ Done       |
| 36  | Compact View Toolbar Controls         | Forms/status/keyword filters become summary-collapsed multiselect dropdowns; AND/OR               | ✅ Done       |
| 37  | Settings Full-Window Overlay          | App settings covers the entire window including the header/tab strip                              | ✅ Done       |
| 38  | Add Project Modal Full-Window         | New-project modal backdrop dims the whole app, not just the body pane                             | ✅ Done       |
| 39  | Project Surfaces as Pages             | Forms, project Settings & new Views surfaces become full-width, well-designed pages               | ✅ Done       |
| 40  | Status Visual Language                | Distinct icon + color + label for every run status, one canonical map, used everywhere            | ✅ Done       |
| 41  | Per-Status Run Counts                 | Card header shows a colored count per status in the group, not one total badge                    | ✅ Done       |
| 42  | Quick-Run from Any Tab                | Run button in both toolbars + ⌘K picker drops a draft card into the current thread                | ✅ Done       |
| 43  | Browser Tab Keyboard Nav              | Ctrl+Tab / Ctrl+Shift+Tab cycling and ⌘W/Ctrl+W close-tab, cross-platform                         | ✅ Done       |
| 44  | Card & Surface Restyle                | Kill the black card boxes: low-contrast surfaces, modern spacing, token-level sweep               | ✅ Done       |
| 45  | AI Services CRUD                      | Settings manages any number of AI services (local/remote), simple by default                      | ✅ Done       |
| 46  | Code View Reveal & Resize             | Script view: copy → reveal-in-Finder; expand chevron → resizable output box                       | ✅ Done       |
| 47  | Scheduling CRUD & Calendar            | Fix broken scheduling, full schedule management, calendar surface on project toolbar              | ✅ Done       |
| 48  | Pinning View-Only                     | Hide the pin action & pinned styling on the title tab — pinning lives in views                    | ✅ Done       |
| 49  | New Form Page Full Width              | Create-form flow drops its narrow centered column and adopts the full-width page style            | ✅ Done       |
| 50  | View Actions Kebab Menu & Modal       | View rename/hide/delete move into a modal launched from a kebab icon in the toolbar               | ✅ Done       |
| 51  | Additive Filter Chips                 | Permanent filter dropdowns become a "+" button adding editable chips, AND-combined                | ✅ Done       |
| 52  | Command-Backed Forms                  | Epic: forms wrap one installed CLI tool directly — command model, direct spawn, preview           | ✅ Done       |
| 53  | Tool Registry & AI Inspection         | Resolve tools, capture --help/man safely, AI-distill to ToolSpec, Tools page                      | ✅ Done       |
| 54  | Form Creation Wizard                  | Chat tool-finder (service+model pick), AI-drafted fields, fully manual fine-tuning                | ✅ Done¹      |
| 55  | Drag-Drop Tool Registration           | Drop an executable to register it; consent-gated inspection or pasted help docs                   | ✅ Done       |
| 56  | Event-Bus Flows                       | Payloads carry artifacts; deterministic payload→field mapping; chains visible in thread           | ✅ Done²      |
| 57  | Tools Management into Settings        | Tools manager leaves the project toolbar; renders as a Settings section under AI Services         | ✅ Done       |
| 58  | Install Custom CLI Tool               | Upload an executable via file picker; copy kept in app config storage; only needs --help          | ✅ Done       |
| 59  | Wizard Step 1: Goal-First Describe    | Goal description box first, service+model (select) second; tool sections move to step 2           | ✅ Done       |
| 60  | Wizard Step 2: Tool Choice & Cache    | Candidate tools from cached registry + AI; version-aware re-inspection; drop zone here            | ✅ Done       |
| 61  | Wizard Step 3: Fields CRUD            | Auto-drafted from goal; label/description/type/optional + per-field CLI cell; preview top         | ✅ Done       |
| 62  | Wizard Step 4: Remove Effects         | Effects rows leave the outputs editor; output kinds + events only; legacy forms still load        | ✅ Done       |
| 63  | Wizard Step Header Navigation         | Clickable 4-step indicator in the wizard header; any reachable step is one click away             | ✅ Done       |
| 64  | Step 3 Field Editor Cards             | Unlabeled widget rows become labeled cards: named controls, accordion, empty-label guard          | ✅ Done       |
| 65  | Plain-Language Field Mapping          | Map fields by picking the tool's real options from its spec, phrased in user terms                | ✅ Done       |
| 66  | Step 3 Live Form Preview              | Interactive "how it will look" pane using the real form components; sample values feed CLI        | ✅ Done       |
| 67  | Wizard Full-Window Takeover           | Form creation covers the entire window like Settings — no tab strip/sidebar distractions          | ✅ Done       |
| 68  | Settings Scroll Fix                   | Expanded settings content runs off-screen unscrollably — min-h-0 flex chain repair                | ✅ Done       |
| 69  | Calendar Day Scheduling               | Click a day → pick a form, fill its fields, scheduled for that date; composer below grid          | ✅ Done       |
| 70  | Surface Jump Shortcuts                | ⌘⇧C Calendar, ⌘⇧V Views, ⌘, Settings — toggling like their toolbar buttons; ⌘P guard fix          | ✅ Done       |
| 71  | Submitted Summary, No Code Tab        | Code tab removed; Submitted shows a friendly value list + the command line that ran               | ✅ Done       |
| 72  | Auto-Size Result Outputs              | Text/JSON/table results hug content up to 400px, scroll beyond; resize handle still works         | ✅ Done       |
| 73  | Native View Menu                      | App menu-bar View menu lists the surface shortcuts (⌘P, ⌘⇧C, ⌘⇧V, ⌘,, ⌘K) and triggers them       | ✅ Done       |
| 74  | Calendar Modals, Confirms & Toasts    | Composer/editor become modals; all confirmations are popup dialogs; results shown as toasts       | ✅ Done       |
| 75  | Escape Always Closes Modals           | Shared Modal component + window-level Escape hook; all modals converted, pattern enforced         | ✅ Done       |
| 76  | First-Run AI Service Wizard           | "First things first" full-window takeover when no AI service is registered; guided setup          | ✅ Done       |
| 77  | Welcome Projects List                 | "Recent projects" → "Projects": all known projects on the home page, search filter for long lists | ✅ Done       |
| 78  | First-Project Welcome Flow            | Full-screen zero-clutter first-run experience when no project exists; chains into ticket 76       | ✅ Done       |
| 79  | Dev User Profiles                     | `bun run dev:hmr:<profile>` launches seeded personas: newbie/beginner/regular/power/edge          | ✅ Done       |
| 80  | Calendar Month-Year Picker            | Calendar's "Month Year" label opens a month/year popover for fast long-range navigation           | ✅ Done       |
| 81  | Scroll Fix & Themed Scrollbars        | Body scroll reliable with expanded run items; one theme-matched scrollbar style everywhere        | ✅ Done       |
| 82  | Delete View Focuses Previous          | Deleting the active view activates its left neighbor instead of jumping to the title tab          | ✅ Done       |
| 83  | New-Tab Browser Shortcut              | ⌘T / Ctrl+T creates a new view tab, matching the browser convention                               | ✅ Done       |
| 84  | View Menu Tab Navigation              | New/Close/Next/Previous Tab shortcuts listed & wired in the native application View menu          | ✅ Done       |
| 85  | Remove the Event Bus                  | Emits/listens-for, auto-submit, payload mapping & artifacts all removed; magic fill stays         | ✅ Done       |
| 86  | Output Definitions: Model & Engine    | Named, configurable outputs with explicit extraction (regex/jsonPath/file) + transforms           | ✅ Done       |
| 87  | Output Definitions: UI & Display      | Wizard step 4 authoring with live test; run card renders raw + each named output block            | ✅ Done       |
| 88  | Workflow Model, Schema & Expressions  | Epic: Workflow/Step/Trigger/Run types, JSON-on-disk schema doc, safe {{…}} expression lang        | ✅ Done       |
| 89  | Workflow Execution Engine             | Sequential/parallel/loop/decision execution via the one command compiler; full run traces         | ✅ Done       |
| 90  | Workflow Triggers                     | Manual (+params), cron-while-running, form-submitted; "Starts workflows" shown on the form        | ✅ Done       |
| 91  | Workflow Editor                       | Vertical list, nested expandable blocks, {{…}} autocomplete, compiled-command previews            | ✅ Done       |
| 92  | Workflow Creation Wizard              | Describe the goal → AI drafts steps/wiring from existing forms → fine-tune in the editor          | ✅ Done       |
| 93  | Workflows Surface & Run Dialog        | Toolbar button + list page; ⌘K searches forms AND workflows; distinct create actions; menu        | ✅ Done       |
| 94  | Workflow Run Log UI                   | Runs tab + CI-style live trace: per-step command, stdout/stderr, skipped-branch reasons           | ✅ Done       |
| 95  | Workflow Dry Run & Step Replay        | Plan-style dry run (nothing executes); replay one step from a past run's captured inputs          | ✅ Done       |
| 96  | Rename "Form" → "Task"                | Product-wide rename: UI copy, menus, docs, code identifiers & filenames; disk format unchanged    | ✅ Done       |
| 97  | Unread Result Badges                  | Sidebar badge = unread finished results; decrements on view; per-project tracking toggle          | ✅ Done       |
| 98  | AI One-Line Run Summaries             | Accordion header shows an AI status report of what happened, persisted per run, with fallback     | ✅ Done       |
| 99  | Native Tools & Browser Automation     | Epic: native tool registry; browser task = fields + recordable/replayable step builder            | ✅ Done⁴      |
| 100 | App Profile Interview                 | AI interviews the user → app-level profile (roles, goals, frustrations); self-improving loop      | ✅ Done       |
| 101 | Project Profile Interview             | Per-project AI-interviewed profile stored in the project folder; reuses the 100 engine            | ✅ Done       |
| 102 | Virtual File System                   | Epic: track any file on any system (local/remote), browse/search/open, run artifacts w/ previews  | ✅ Done⁵      |
| 103 | Package-Manager Tool Install          | Detect/register package managers; search their catalogs; consent-gated install → registry         | ✅ Done       |
| 104 | Duplicate Workflow                    | One-click deep copy of a workflow (triggers disabled) straight into the editor                    | ✅ Done       |
| 105 | Task Adoption & Versioning            | Draft → adopt lifecycle; edits fork new versions; opt-in retroactive workflow upgrades            | ✅ Done³      |
| 106 | Project Audit Page & RSI Loop         | Epic: audit log + dossier + Datalog theorem prover over run facts + AI-prescribed improvements    | ⏸ Hold        |
| 107 | Interview Model Picker                | Choose the AI service + model powering a profile interview; remembers last choice per scope       | ✅ Done       |
| 108 | Interview Error Recovery & Cancel     | No dead ends: cancel always available, failed AI calls get retry states, RPC timeouts caught      | ✅ Done       |
| 109 | Interview Draft Review Scroll Fix     | Review step scrolls again — auto-grow textareas stop swallowing the wheel (not a min-h-0 bug)     | ✅ Done       |
| 110 | Interview Question Logic & Categories | Stop parroting the user's answers back; each question shows the category it belongs to            | ✅ Done       |
| 111 | Interview-First Onboarding            | First-run opens with an interview; detects AI/project state and tailors flow + starter checklist  | ✅ Done⁶      |
| 112 | Task List Kebab → Edit Form           | Remove the misaligned row kebab; Adopt/Version History/Edit Steps move into the edit surface      | ✅ Done       |
| 113 | Task List Row Click Behavior          | Clicking a row manages the task instead of dropping a draft run card into the thread              | ✅ Done       |
| 114 | Finish Forms→Tasks Rename & Seeder    | Rename leftover `form` identifiers (AppContext etc.); fixes `dev:*` NOT NULL form_slug crash      | ✅ Done⁷      |
| 115 | Auto-Delete Empty Views               | Filterless views are cleaned up automatically (grace period while active; named views kept)       | ✅ Done       |
| 116 | AI View Naming + Manual Override      | AI names/renames views; double-click tab or inline rename; explicit names stop auto-naming        | ✅ Done       |
| 117 | Calendar Schedules Workflows          | Day-click composer picks tasks or workflows; scheduled workflow runs on the grid + scheduler      | ✅ Done       |
| 118 | Files Surface Fix & Theming           | Make the VFS Files surface actually work and restyle it to the app's visual language              | ✅ Done⁸      |
| 119 | Compact Density Pass                  | Tighten margins/padding across surfaces; compact presentation where a tight default isn't enough  | ✅ Done⁹      |
| 120 | Full-Width Screens                    | App/project pages drop centered max-width columns and use the full window width                   | ✅ Done¹⁰     |
| 121 | Loading States & Smooth Transitions   | No FOUC: branded launch loader, animated surface/tab transitions, skeletons for async content     | ✅ Done¹¹     |
| 122 | Signature Motion & UX Flair           | Motion identity: signature easing, elevated run/status/delight moments, motion-design note        | ✅ Done¹²     |
| 123 | Speech Mode                           | Wave icon toggles voice mode: speak commands through the command surface, app speaks results      | ✅ Done¹³     |
| 124 | Diagnostics Screen                    | App/machine/workload health: memory, CPU, disk, running work, scheduler/watcher status, copy      | ✅ Done¹⁴     |
| 125 | Transparency Reveal                   | All collected user data in one folder with a generated manifest and a Reveal-in-Finder button     | ✅ Done¹⁵     |
| 126 | Sidebar Project Status Rows           | Two-line project rows: type-split unread badges (✓/✗), recency, explicit clear, unread bolding    | ✅ Done¹⁶     |
| 127 | Seed Example Workflows                | Starter catalog + all five dev profiles seed real workflows (incl. recurring for calendar demo)   | ✅ Done¹⁷     |
| 128 | Calendar Views                        | Day/Week/Month/Agenda switcher, Today + keyboard paging, +N overflow, filters, drag-reschedule    | ✅ Done¹⁸     |
| 129 | Recurring Series Model                | Real series concept: delete one occurrence vs. delete the series (standard calendar pattern)      | ✅ Done¹⁹     |
| 130 | File Picker New Folder                | chooseDirectory can create folders (native option or in-app fallback) — no Finder round-trip      | ✅ Done²⁰     |
| 131 | Package Manager Controls              | Real enable/disable toggle, preference via order, drag-and-drop reorder replaces arrow buttons    | ✅ Done²¹     |
| 132 | App Files Project Toggle              | App-level Files view can include project locations (grouped); confirm/surface app-level task I/O  | ✅ Done²²     |
| 133 | Compact Tabs, Toolbars & V-Labels     | Compact mode reaches view tabs/toolbars (icon-only + tooltips); full-width tabs; vertical dates   | ✅ Done²³     |
| 134 | Reports                               | Epic: curated collections of tasks/workflows/files exported to PDF for sharing progress           | ✅ Done²⁴     |
| 135 | AI Service Model Dropdown             | AIServiceEditor reuses ServiceModelPicker: live model list instead of free-text override          | ✅ Done       |
| 136 | Tool Test Modal                       | Per-tool Test button: consent-gated REPL-style run surface with the tool's docs alongside         | ✅ Done       |
| 137 | Speech Settings & Push-to-Talk        | Speech section in Settings (status, voice, tests, persisted prefs); key press gates each listen   | ✅ Done       |
| 138 | Voice Companion Window                | Epic: floating chromeless "Jarvis" circle — animated waveform, greeting, talk-back, transcript    | ✅ Done²⁵     |
| 139 | Workflow Apps                         | Branded workflow bundles opening as a hyperfocused surface/window (builds on 138's plumbing)      | ⬜ Open       |

¹ Ticket 54: create flow (all 4 steps) is complete; reopening the wizard to
edit an existing command-backed form (section 5) is not wired — "Edit" on
FormsPanel still only edits name/description/tags.
² Ticket 56: artifact collection, deterministic payload→field mapping, and
card display (trigger/artifacts/emits-listeners) all work backend-to-UI;
the wizard has no step yet to author a field's `payloadMapping` — it must
be set by hand in `form.json` until a follow-up adds that picker.
³ Ticket 105: model, disk layout, RPC, adoption affordance, badges, version
history + rollback all landed; the edit-as-new-version wizard flow and the
save-time UpgradeWorkflowsModal are wired but unreachable until a
task-definition editor exists (same pre-existing gap as footnote ¹) — the
modal ships ready for that follow-up.
⁴ Ticket 99: model, engine, step builder, wizard routing, recorder window,
replay & coordinate fallback all landed. Electrobun's `executeJavascript`
is fire-and-forget (no return channel), so extract/assert results and
recorded-event retrieval are best-effort until a page→bun RPC bridge is
added (documented in `src/bun/browser/recorder.ts` and `browserRun.ts`);
window-resize enforcement for coordinate mode awaits an Electrobun resize
API.
⁵ Ticket 102: local provider, path-containment security, locations
registry (app + project scope), fileAssociations, declared+observed
run artifacts, artifact strip + preview modal, and Files surfaces all
landed. Dropbox/Google Drive are interface-conforming connect stubs per
the ticket; full OAuth connectors are follow-up tickets.
⁶ Ticket 111: the onboarding interview is scripted (fixed questions),
not AI-generated — it necessarily runs before any AI service is
configured, so the ticket-100 engine can't drive it. Answers land in
the app profile; the deeper AI interview remains in Settings → Profile.
AI is a requirement: the flow never offers a no-AI path and always ends
in the AI wizard unless a service already exists. Starter relevance is
copy-level (the checklist echoes the user's stated goal); AI-ranked
starter selection would be a follow-up once a service exists at that
point in the flow.
⁷ Ticket 114: the seeder crash root cause (`formSlug` param vs. the
renamed `taskSlug` CreateRunInput field) is fixed and all five
`bun run dev:*` profiles verified seeding cleanly. The rename sweep
covers `AppContext.tsx`'s state/API surface, the `TaskCard`/`TaskCardBody`/
`SubmittedSummary`/`SubmissionAccordion*`/`GridCard`/`RunPicker` render
family, the workflow engine/draft/trigger modules, and comments/prompt
copy throughout `src/bun` and `src/mainview`. Left untouched by design:
the on-disk `forms/` directory, `form.json`, `meta.json`, the
`form_slug`/`form_version` DB columns, and the `type: "form"` workflow
step discriminant (reused by `workflowDraft.ts` for the AI response
parser) — all firewalled per the ticket-96 disk-format boundary and
already documented as such in `history.ts`/`store.ts`/`loader.ts`.
⁸ Ticket 118: confirmed and fixed three root causes — the VFS RPCs never
threaded a `project` param so project-scoped locations could never be
found; `FilesPage.tsx` stored a project's display name where the
registry expects a path; `ArtifactModal.tsx`'s preview loading was dead
code. Verified via `tsc` and code tracing only — not exercised in the
running Electrobun app from this environment; worth a live pass with
`bun run dev:regular` before fully trusting it.
⁹ Ticket 119: a CSS-custom-property density scale (`index.css`) drives
page/card/row spacing across Tasks/Views/Calendar/Settings/Thread via
arbitrary Tailwind values, tightened ~15-20% at the root and further via
a persisted Compact mode toggle (`UIState.compactMode`) — one systemic
mechanism instead of a per-component boolean. No before/after
screenshots produced (no way to drive the running app visually from
this environment).

²⁴ Ticket 134: landed model + builder + Markdown export per the ticket's own
scope guard, splitting PDF polish to a follow-up rather than building it
speculatively. New `Report` entity (`src/shared/types.ts`) — `id`/`name`/
`description`/ordered `members`/timestamps — with four member kinds (task,
workflow, file, note), each carrying a stable `id` for reordering plus an
optional free-text section note; task/workflow members store specific
`runIds` (empty = "most recent run" at export time) rather than copying run
data, and file members store a bare self-contained `uri` (same shape as
`RunArtifact.uri`) instead of a `{locationId, path}` pair so a report keeps
working even if the VFS location is later renamed/removed — resolved via a
new `vfsResolveUri` RPC at pick time. `src/bun/reports/store.ts` mirrors
`workflows/store.ts`'s "id is identity, filename follows slugified name"
pattern one-for-one but skips its disk-format-translation layer entirely —
Report has no legacy on-disk shape to reconcile, being a brand-new entity.
`src/bun/reports/export.ts` renders Markdown fresh from current data on
every export (task runs via `db/history.ts`, workflow runs via
`workflows/runStore.ts`, both surfacing ticket-98 AI summaries where
present; file members get a best-effort inline text preview for
text/JSON-mime files under 2KB via the VFS provider's own `read()`), writing
to `<project>/reports/exports/<slug>-<timestamp>.md` — no new dependency
needed, confirming the ticket's own hunch that Markdown is "cheap
insurance." RPCs/UI follow the Workflows precedent throughout: `ReportsPage`
is a `ProjectSurface` page-tab (⌘⇧R, `ProjectToolbar` button) per tickets
39/120's page-vs-takeover convention, while the single `ReportEditor` (one
component handles both create and edit, unlike Workflow's separate
wizard/editor split — Reports needs no AI-drafting step) is a `reportEditor`
full-window takeover in `AppContext`, guarded into the same `overlayOpen`
checks as `workflowEditor`. `AppContext`'s "new" mode carries a concrete,
once-generated blank `Report` (via a small standalone `reportUtils.ts`
rather than importing across the `AppContext`↔`ReportEditor` boundary) —
first draft generated it inline in JSX on every render, which desynced the
editor's dirty-check against a fresh `initial` object each time and would've
falsely warned "unsaved changes" on an untouched new report; caught and
fixed before verification. `FilePickerModal`/`RunsPickerModal` are new,
trimmed-down single-purpose pickers (not reuses of the full `FilesPage`
browser, which carries search/multi-location/remove affordances a one-shot
picker doesn't need). Verified via `tsc --noEmit` (clean) and a Vite preview
boot with no console errors; same native-Electrobun-bridge limitation as
tickets 118/121/123-133 kept the Reports/Workflows surfaces themselves from
being click-tested live (they require an active project via the native
bridge, unreachable from a plain browser preview).
¹⁰ Ticket 120: dropped `mx-auto` (the actual centering mechanism) and
widened the content cap on Settings/Project Settings/Profile Interview/
workflow editor page bodies. `FirstRunAIWizard` deliberately kept
centered — a hero-style onboarding screen matching `FirstRunWelcome`'s
same convention, not a data-browsing page. Not verified live.
¹¹ Ticket 121: inline boot shell in `index.html`, one shared
`SurfaceTransition` primitive for surface/view-tab switches, a takeover
fade class on all five full-window overlays, and a `viewsLoading`
skeleton in `ViewsPage.tsx`. Set up `.claude/launch.json` (Vite dev
server) and verified the boot shell + first-run onboarding render
correctly live with no console errors; Tasks/Views/Calendar need a real
project (native bridge) so those surfaces' transitions weren't
click-tested, only `tsc`-checked and code-read.
¹² Ticket 122: motion note added to the Visual language section above;
`--clide-ease` consolidates every animation's easing. Card-enter
(`TaskCard.tsx`), status-pulse (`StatusIcon`, keyed by status so only
real changes retrigger it), and a `.clide-press` send-button delight
moment all ship. Also fixed three more ticket-96/114 rename stragglers
found along the way (`FormCardFooter`/`FormCardMenu`/`FormPreview`).
App verified booting error-free via the Vite preview; the animations
themselves need a real run in the thread (native bridge) to see, so
not eyes-on verified.
¹³ Ticket 123: browser Web Speech API — `speechSynthesis` for voice out
(universal, no permission), `SpeechRecognition` for voice in, feature-
detected since WebKit (Electrobun's webview) generally lacks it, exactly
the "must degrade clearly" case the ticket anticipated. Recognized
commands open the existing ⌘K `RunPicker` pre-filled rather than a
separate code path; voice out speaks ticket-98 run summaries as they
arrive. Never persisted — always off on boot. Verified booting
error-free via Vite preview; the wave icon needs an active project to
render, so not eyes-on in the real Electrobun/WebKit target.
¹⁴ Ticket 124: `getDiagnostics` RPC gathers everything fresh per call —
`node:os` + `process` for machine/app stats, `df -k` for free disk (no
portable API), small counter exports added to `runner/registry.ts`/
`workflows/engine.ts`/`scheduler.ts`/`workflows/schedules.ts` for
workload counts (reusing their existing in-memory state rather than
re-deriving it), AI services pinged on-demand via a per-service Test
button. Full-window takeover launched from Settings, 5s refresh only
while open, Copy-diagnostics plain-text export. App verified booting
error-free; the screen itself needs an active project to reach, so not
eyes-on verified.
¹⁵ Ticket 125: new `src/bun/transparency.ts` holds a code-level registry
(`collectionEntries()`) of every place the app persists user data —
app-scoped files under `appDataDir()`, the keychain for AI credentials,
and one entry per registered project pointing at its own self-contained
folder (ticket 17). `TRANSPARENCY.txt` is regenerated from that registry
on every reveal rather than hand-written, so it can't drift from what's
actually collected. Settings' new "Transparency" row calls
`prepareTransparencyReveal` then reuses the existing `api.openFolder`
RPC. Verified via `tsc --noEmit` and the Vite preview (clean boot, no
console errors); the Reveal button itself needs an active project to
reach, so not eyes-on click-tested.
¹⁶ Ticket 126: `Sidebar.tsx`'s per-project rollup now splits into
`unreadSuccess`/`unreadError` counts plus a `latest` timestamp (no new
RPC — pure local aggregation over runs already loaded); a
`formatRecency()` helper renders "Nm/h/d ago". A "needs attention"
third bucket was considered but `RunStatus` has no partial/timeout
state distinct from success/error, so it's skipped per the ticket's own
escape hatch. `SidebarProject.tsx` is now two lines: name, then chips +
recency + a hover-revealed "mark all read" check button. Clearing reuses
the existing `markRunsRead` RPC — `AppContext`'s new
`markProjectRunsRead(projectName)` resolves unread run ids from
`tasksBySlug` and batches them, so `history.ts` needed no changes.
`SubmissionAccordionRow.tsx` bolds the summary text for unread rows,
returning to normal weight once read. This is an Electrobun-bridged
desktop view (RPC calls only work under the native shell), so a plain
Vite preview can't exercise it; verified via `tsc --noEmit` only.
¹⁷ Ticket 127: new `workflows/seed.ts` mirrors `tasks/seed.ts`'s starter
catalog — two workflows ("System Report", a decision; "Directory Loop",
a loop) composing the existing `list-files`/`system-info` starter
tasks — exposed as `listStarterWorkflows`/`installStarterWorkflows`
(RPC + client wrapper, parallel to the task variants; not yet wired
into `FirstRunWelcome`'s onboarding checklist, which was out of this
ticket's file list). The loop needed a real list to iterate, so
`system-info` gained a `checks` named output (ticket 86 output
definitions) in both `tasks/seed.ts` and the independently-duplicated
`seed-profile.ts` template. All five dev-profile fixtures now seed
workflow entities scaled to their persona (none for newbie; one
decision workflow for beginner; a decision + loop workflow per regular
project with a weekly-recurring `ScheduledWorkflowRun` on the first;
the same pair plus stacked schedules on power's three heavy-treatment
projects; edge adds a workflow with a dangling task reference and an
orphaned schedule pointing at a deleted workflow id). Scheduling reuses
`schedules.ts`'s disk format but through a new `seedScheduledWorkflowRun`
that skips `scheduleWorkflowRun`'s `arm()` — that sets a real
`setTimeout`, which would've hung the one-shot seeder the same way
ticket 114's bug did. Verified via `tsc --noEmit`, all five `bun run
seed:profile` runs (one per `CLIDE_PROFILE`) completing and exiting
cleanly, and a scratch script confirming `installStarterWorkflows`
round-trips through `saveWorkflow`/`listWorkflows` with the expected
disk `formSlug` translation.
¹⁸ Ticket 128: `CalendarPage.tsx` becomes a thin shell over four new
subcomponents in `src/mainview/components/calendar/` — `MonthView`
(the old grid, extracted), `TimeGrid` (a shared 24-hour axis reused by
new `DayView`/`WeekView`), and `AgendaView` (a flat chronological list
spanning a rolling 90-day window, grouped by date, every row — real or
projected occurrence — clickable and "Repeats daily/weekly"-labeled,
satisfying the original "list of all recurring tasks/workflows" ask
directly). `calendarUtils.ts` holds the shared `Chip`/date/range
helpers, including a `buildChipsByDay`/`buildAgendaChips` split and an
`endOfDay` range-end fix so single-day/week ranges don't silently drop
afternoon occurrences (the old month-only grid math never hit this
because month ranges always ended at a grid boundary day, not a real
period edge). View choice persists via a new `calendarView` field on
`UIState` (mirrors `compactMode`'s existing load/save wiring in
`AppContext.tsx`); Today and `[`/`]`/arrow-key period paging are
view-aware and follow the same overlay-guard convention as `App.tsx`'s
global shortcuts (inert while the composer or a schedule-detail modal
is open, or focus is in a text field). Month's "+N more" now drills
into Day view anchored on that date instead of just being inert text —
the ticket's own suggested resolution once Day view existed. A
Tasks/Workflows filter legend (local component state, not persisted)
gates the chip set in every grid/list view. Drag-to-reschedule shipped
rather than being split out: real (non-projected) chips are
HTML5-draggable, dropped either on a Month day cell (keeps the chip's
original time-of-day) or a Day/Week hour cell (adopts the exact slot);
both paths reuse the existing `updateScheduledRun`/`rescheduleWorkflowRun`
RPCs with a past-time guard before committing. `CalendarComposer.tsx`
gained an optional `initialTime` prop so Day/Week empty-slot clicks
prefill the exact clicked hour instead of the existing 09:00/next-hour
heuristic (Month/Agenda day-clicks pass no time and keep that
heuristic unchanged). Verified via `tsc --noEmit` and a clean Vite
preview boot (no console errors); Calendar itself needs an active
project via the native Electrobun bridge, so the new views weren't
click-tested live from this environment — same limitation noted on
tickets 118/121/123-126.
¹⁹ Ticket 129: series/skip-list design chosen over a full recurrence-rule
rewrite — a run/`ScheduledWorkflowRun` keeps its `repeatInterval` as the
cadence and gains `skipDates: string[]`, exact ISO instants excluded
from that series' projection. "Delete this occurrence" branches on
whether the clicked chip is the item's own pending fire time or a
projected (dashed) future date: the former advances `scheduledAt` to
the next non-skipped occurrence in place (new `deleteOccurrence` in
`scheduler.ts`, `deleteWorkflowOccurrence` in `workflows/schedules.ts`
— both share an `advanceOccurrence` helper with `fire()`'s existing
"skip past missed occurrences" loop, now also skipping `skipDates`);
the latter just appends to `skipDates` and leaves the pending row
untouched. `skipDates` (filtered to still-future entries) carries
forward whenever a task's fire creates its next row or a workflow's
fire advances in place, so a skip made three cycles out survives the
rows in between. `skip_dates` is an additive nullable `runs` column
(disk-format-firewall: absent/null reads back as `[]`, no migration of
existing schedules needed); the workflow JSON side normalizes missing
`skipDates` the same way on read. Frontend `projectOccurrences` takes
the series' `skipDates` and excludes any generated instant present in
it — same `addDays`-stepping algorithm as the backend's
`nextOccurrence`, so a projected chip's `toISOString()` and the
backend's recomputed instant line up exactly when the click round-trips
through the `deleteOccurrence`/`deleteScheduledWorkflowOccurrence` RPCs.
`ScheduleDetail`'s single "Cancel" button splits into "Delete this
occurrence"/"Delete the series" only when `repeatInterval !== "none"`;
non-recurring entries keep the original single confirm copy verbatim.
Verified via `tsc --noEmit`; same native-bridge limitation as ticket
128 kept this from being click-tested live.
²⁰ Ticket 130: confirmed Electrobun's `openFileDialog` FFI call takes no
can-create-directories flag (five fixed args, straight through to the
native panel), so this went the in-app-fallback route rather than a
native option. New `createDirectory` RPC (`{ parent, name }`, sanitizes
the name against slashes/`.`/`..`, mkdir via the existing `ensureDir`
helper, rejects if the target already exists) backs a single shared
`useDirectoryPicker` hook (`src/mainview/hooks/useDirectoryPicker.ts`)
that wraps `api.chooseDirectory`: after a parent folder is picked, a
new `prompt()` primitive on `UIFeedback` (mirrors the existing
`confirm()` — same imperative context, a `PromptDialog` alongside
`ConfirmDialog`) offers an optional "New folder" name; blank/cancelled
just uses the picked folder as-is, so the common case costs one
dismissible dialog rather than a hard extra step. `FilesPage.tsx`,
`NewProjectModal.tsx`, and `WelcomeScreen.tsx` all swap their direct
`api.chooseDirectory()` call for this one hook — no per-site duplication.
Verified via `tsc --noEmit` only; same native-bridge limitation as
tickets 118/121/123-129 (the picker and mkdir both require the native
Electrobun shell, not exercisable from a plain Vite preview).
²¹ Ticket 131: `PackageManagersSection.tsx`'s enabled/disabled label
became a real checkbox wired through the existing
`savePackageManagers`/`packageManagers.ts` cache round-trip (same
persisted shape as before — no migration). Preference reuses list
order rather than adding a second "preferred" flag: a new
`getOrderedEnabledAdapters()` in `packageManagers.ts` reads the merged
cache+builtin list, filters to `enabled !== false`, and preserves that
order — `searchPackageManagers` now iterates this filtered/ordered set
instead of the raw builtin array (so disabled managers drop out of
catalog search and results surface in preference order), and
`installPackage` rejects with "Package manager is disabled" if the
requested `managerId` isn't in that set (closes the gap where a
disabled manager was still directly installable by id).
`resolvePackageBinaries` is left ungated since it only runs after an
install already succeeded. The row-level up/down arrows are replaced
by HTML5 drag-and-drop (`draggable`, `onDragStart`/`onDragOver`/`onDrop`
on each row, a `GripVertical` handle) calling the same
`savePackageManagers` persistence; the arrows survive as a
low-opacity secondary affordance (`aria-label`s, revealed on
hover/focus) and rows are keyboard-reorderable via focus +
ArrowUp/ArrowDown. The top enabled row gets a small "Preferred" badge
for clarity. Verified via `tsc --noEmit` only; same native-bridge
limitation as tickets 118/121/123-130 (the package-manager RPCs
degrade to no-ops outside the Electrobun shell, so drag/toggle
behavior wasn't click-tested live from this environment).

²² Ticket 132: `FilesPage.tsx`'s app-scoped instance gained an "Include
project files" checkbox that additionally fetches a new
`listAllProjectVfsLocations` RPC (`registry.listAllProjectLocations()`,
iterating `listProjects()` + each project's `vfs.json`) and renders it
grouped under per-project headers alongside the app-scoped list — every
sidebar row is now a `{ location, projectName? }` pair so the `vfs*` RPC
calls for a *project*-owned location shown in the app view pass that
location's own project instead of the app view's (always-undefined) one,
which they need to resolve at all. Second half of the ticket — whether
app-level locations already work end-to-end for task/workflow I/O — was
investigated and then verified by exercising the real
`addLocation`/`getLocation`/`snapshotAssociatedLocations`/`diffSnapshots`
code path under a throwaway `CLIDE_PROFILE` (no real app data touched):
confirmed no gap, `getLocation` already checks app scope first regardless
of the project passed in. A different, unrelated gap turned up while
checking task/workflow "location pickers": no UI anywhere sets
`task.fileAssociations` for *any* scope (it's meta.json-only, read by
`artifacts.ts` but never written from `src/mainview`) — flagged as a
follow-up rather than built speculatively, since it's a new editor
surface with its own UX, not an app/project-scope gap. Verified via
`tsc --noEmit` plus the standalone script above; the Files-view toggle
itself wasn't click-tested live from this environment (same native-bridge
limitation as tickets 118/121/123-131).

²³ Ticket 133: extended the ticket 119 `.clide-compact` root-class pattern
from CSS-variable density tokens to full Tailwind rules via arbitrary
variants (`[.clide-compact_&]:px-3`, compiling to `.clide-compact .el`),
so `ViewTabs`/`ViewToolbar`/`ProjectToolbar`/`Toolbar` tighten in compact
mode with no JS branching on `compactMode`. Toolbar text labels wrap in
`<span className="[.clide-compact_&]:hidden">` for icon-only collapse —
every button already had a `title`, so the tooltip requirement was
already met. View tabs dropped their `max-w-[200px]`/`max-w-[120px]`
caps in favor of `flex-1` + `min-w-0` + `truncate`, so tabs share the row
width and only truncate under real pressure. Added a reusable
`.clide-vertical-label` utility (`order: -1`, `writing-mode: vertical-rl`,
`rotate(180deg)`, scoped under `.clide-compact`) and applied it to the
timestamp in `SubmissionAccordionRow.tsx` only — left off the summary
text per the ticket's "structural, not primary content" guidance; the
class is generic enough for the ticket's named follow-ups (day-group
headers, dense table columns) to reuse directly. Verified via
`tsc --noEmit` and, unusually, by inspecting the live dev server's
compiled `document.styleSheets` to confirm the arbitrary-selector syntax
produced the intended `.clide-compact .el` rules rather than silently
no-op'ing — stronger than the tsc-only checks on recent tickets, but the
dev session available here was mid-onboarding with no seeded project, so
the actual tab/toolbar/row layout in compact mode wasn't eyeballed live;
worth a look on `dev:regular`.

²⁵ Ticket 138: landed (a)-(c) of the ticket's own suggested sequencing —
window shell, both states, and talk-back — with (d) animation kept
intentionally simple (procedural CSS bars, not the "real design time"
polish the ticket flags as a stretch goal). New second `BrowserWindow`
(`src/bun/index.ts`'s `ensureCompanionWindow`/`companionRpc`) is frameless,
transparent, always-on-top, ~220×220, positioned from and persisting to a
new `UIState.companionPosition` (debounced on the native `move` event);
dragging needed no custom mouse tracking — Electrobun already ships a
native drag-region primitive (`electrobun-webkit-app-region-drag`, the same
class the main window's own title bar uses) that the companion's whole
compact face opts into. Compact⇄expanded is one window resizing via a new
`resizeCompanion` RPC, not two windows. The companion owns no speech APIs
itself: the main window's existing `speechSynthesis`/`SpeechRecognition`
calls (tickets 123/137) stay the single source of truth, and
`speech.ts`'s `speak()` gained an optional `onPhase` callback
(start/boundary/end) that `AppContext`'s new `speakToCompanion` relays over
bun IPC (`relayCompanionSpeechPhase`/`relayCompanionTranscriptLine`) to
drive the companion's waveform and transcript — bar heights are
randomized per `boundary` event rather than sampled, since WebKit exposes
no audio buffer to analyze. Greets once per app launch (bun-side
`companionGreetedThisSession` guard survives React StrictMode's double-
mount in dev); task-run completions and errors are narrated the same way
through the existing ticket-98 `onRunStatus` summary, deferring to ticket
123's speech mode if that's already talking so the two features never
overlap. Workflow-run completions are **not** narrated — the ticket's own
text points at "ticket 98's AI run summaries" specifically (task runs),
and `WorkflowRun` has no equivalent single-line summary to read; a
follow-up would need to add one. Muted talk-back still posts to the
transcript and pulses the compact face instead of speaking. Recognized
voice commands (ticket 123's push-to-talk) now also show up as "heard"
lines in the transcript, and the mic-open state relays live so the face
shows a listening ring. Enabled/muted persist in `UIState.companionEnabled`
/`companionMuted`, with a new Settings section (`CompanionSettingsSection`)
alongside toggles reachable from either the companion's own hide/mute
buttons or Settings — both paths funnel through one bun-side function per
flag, and push `onCompanionEnabledChanged`/`onCompanionMutedChanged` back
to the main window so the two stay in sync regardless of which side
changed it. Fixed a latent bug surfaced while adding these fields: the
generic `saveUIState` RPC handler overwrote the whole `UIState` file with
whatever the renderer's known fields were, which would have silently
dropped `companionPosition` on the next unrelated settings change — it now
reads-merges-writes. The renderer build is now genuinely two pages: Vite's
`root` widened from `src/mainview` to `src`, with `vite.config.ts` declaring
both `src/mainview/index.html` and a new `src/companion/index.html` as
`rollupOptions.input`; `electrobun.config.ts`'s copy step lands the
companion's build output as `companion.html` inside the existing
`views/mainview/` host (rather than a second host) so it shares the one
copied `assets/` folder instead of needing a duplicate. Verified via
`tsc --noEmit`, a clean `vite build` (confirms the multi-page output/asset
paths resolve as `views://mainview/...` expects), and click-testing the
companion's React app directly in the Vite dev server (state transitions,
mute toggle, compact/expanded layout, waveform — RPC calls no-op
gracefully outside Electrobun, same degrade-gracefully pattern as
`mainview/rpc.ts`). The actual second `BrowserWindow` — real OS-level
transparency/always-on-top/native dragging, and the main window actually
speaking on launch — needs the native Electrobun shell to see, the same
limitation noted on nearly every ticket since 118.
