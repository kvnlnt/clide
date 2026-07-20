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
| 107 | Interview Model Picker                | Choose the AI service + model powering a profile interview; remembers last choice per scope       | ⬜ Open       |
| 108 | Interview Error Recovery & Cancel     | No dead ends: cancel always available, failed AI calls get retry states, RPC timeouts caught      | ⬜ Open       |
| 109 | Interview Draft Review Scroll Fix     | The "Here's the draft" review step scrolls (min-h-0 chain repair per ticket 68 pattern)           | ⬜ Open       |
| 110 | Interview Question Logic & Categories | Stop parroting the user's answers back; each question shows the category it belongs to            | ✅ Done       |
| 111 | Interview-First Onboarding            | First-run opens with an interview; detects AI/project state and tailors flow + starter checklist  | ✅ Done⁶      |
| 112 | Task List Kebab → Edit Form           | Remove the misaligned row kebab; Adopt/Version History/Edit Steps move into the edit surface      | ✅ Done       |
| 113 | Task List Row Click Behavior          | Clicking a row manages the task instead of dropping a draft run card into the thread              | ⬜ Open       |
| 114 | Finish Forms→Tasks Rename & Seeder    | Rename leftover `form` identifiers (AppContext etc.); fixes `dev:*` NOT NULL form_slug crash      | ⬜ Open       |
| 115 | Auto-Delete Empty Views               | Filterless views are cleaned up automatically (grace period while active; named views kept)       | ⬜ Open       |
| 116 | AI View Naming + Manual Override      | AI names/renames views; double-click tab or inline rename; explicit names stop auto-naming        | ⬜ Open       |
| 117 | Calendar Schedules Workflows          | Day-click composer picks tasks or workflows; scheduled workflow runs on the grid + scheduler      | ⬜ Open       |
| 118 | Files Surface Fix & Theming           | Make the VFS Files surface actually work and restyle it to the app's visual language              | ⬜ Open       |
| 119 | Compact Density Pass                  | Tighten margins/padding across surfaces; compact presentation where a tight default isn't enough  | ⬜ Open       |
| 120 | Full-Width Screens                    | App/project pages drop centered max-width columns and use the full window width                   | ⬜ Open       |
| 121 | Loading States & Smooth Transitions   | No FOUC: branded launch loader, animated surface/tab transitions, skeletons for async content     | ⬜ Open       |
| 122 | Signature Motion & UX Flair           | Motion identity: signature easing, elevated run/status/delight moments, motion-design note        | ⬜ Open       |
| 123 | Speech Mode                           | Wave icon toggles voice mode: speak commands through the command surface, app speaks results      | ⬜ Open       |
| 124 | Diagnostics Screen                    | App/machine/workload health: memory, CPU, disk, running work, scheduler/watcher status, copy      | ⬜ Open       |
| 125 | Transparency Reveal                   | All collected user data in one folder with a generated manifest and a Reveal-in-Finder button     | ⬜ Open       |

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
