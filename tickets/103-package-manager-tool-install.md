# Ticket 103 — Package-Manager Tool Discovery & Install

## Goal

Tool registration today only sees what's already on disk
([resolveTool](../src/bun/tools/inspect.ts) PATH lookups, drag-drop, file
picker). Expand the tool manager to **reach through package managers**: the
app detects which managers are installed, lets the user register others,
searches their catalogs when a tool isn't found locally, and — with
consent — **delegates installation** to the manager, streaming progress,
then bubbles the freshly installed binary straight into the existing tool
registry (resolve → help capture → AI inspection) so the user lands back in
their flow with the tool registered and selected. One continuous,
impressive motion: _"I want `ffmpeg`" → "It's in Homebrew — install?" →
watch it go → keep building the task._

## Acceptance criteria

### 1. Package manager detection & registry

- `src/bun/tools/packageManagers.ts`: a `PackageManager` adapter interface
  — `detect()` (is it installed + version), `search(query)`,
  `info(pkg)`, `install(pkg)` (streaming), `resolveBinaries(pkg)` (what
  executables did this package provide, and where). Built-in adapters,
  macOS-first: **Homebrew**, **npm/bun (global)**, **pipx** (fall back to
  `pip --user`), **cargo**; the interface makes apt/dnf/etc. cheap later.
- On first open of the tools surface (and on demand via "Re-detect"), the
  app probes adapters and shows detected managers with version badges.
  Detection is cached in the app-scoped config; a manager disappearing
  (uninstalled) degrades gracefully to "not detected".
- Users can **register a custom manager**: name + absolute path to the
  binary + command templates for search/install/list-binaries (sensible
  defaults shown). Per-manager **enable/disable** toggle — disabled
  managers are excluded from search and install.
- Surface: a **Package Managers** subsection inside the ticket-57 Tools
  section of [SettingsPanel.tsx](../src/mainview/components/SettingsPanel.tsx).

### 2. Expanded search

- Tool search — in the Settings Tools section and the wizard's tool-choice
  step ([ToolChooser.tsx](../src/mainview/components/ToolChooser.tsx),
  ticket 60) — becomes tiered: ticket 99's Native section first (when
  landed), then registered tools, then PATH-resolvable binaries, then a
  **"Search package managers"** expansion (explicit
  affordance or automatic when local results are empty) fanning out to all
  enabled managers in parallel.
- Catalog results are visually distinct: manager badge (brew/npm/pipx/
  cargo icon), package name, one-line description, installed-or-not state.
  Already-installed packages resolve to their local binary instead of
  offering a reinstall.
- Searches are debounced, cancellable, and time-capped per manager — one
  slow manager must not stall the rest (results stream in per manager).

### 3. Consent-gated install delegation

- Choosing a catalog result shows an install confirmation: the **exact
  command to be run** (`brew install ffmpeg`), the manager, and the
  package's info/homepage. Nothing installs without this explicit consent;
  **never sudo** — a manager needing elevation fails with guidance to run
  it manually, then "Re-detect".
- Install runs through the existing streaming subprocess machinery with a
  live log (ticket 94 CI-trace styling), cancel button, and a clear
  success/failure terminus. Only one install at a time.

### 4. Bubble-up into the tool registry

- On install success: `resolveBinaries(pkg)` finds the provided
  executables (package name ≠ binary name — e.g. brew formulae list their
  linked binaries; npm reads the package's `bin` map; **never guess** from
  the package name alone). Multi-binary packages prompt the user to pick
  which one(s) to register.
- Each chosen binary flows through the **existing** pipeline untouched:
  `resolveTool` → `captureHelp` → AI distillation → `saveTool`
  ([registry.ts](../src/bun/tools/registry.ts)). The registry entry
  records provenance (`installedVia: { manager, package, version }`) so
  the Tools list can show it and future version-aware re-inspection
  (ticket 60) knows where it came from.
- **Flow continuity is the whole point**: if the install started from the
  wizard's tool-choice step, the wizard is waiting when inspection
  finishes with the new tool selected; from Settings, the Tools list
  refreshes with the new entry highlighted, with a toast either way
  (ticket 74).

## Files to modify

- New: `src/bun/tools/packageManagers.ts` (+ one file per adapter if it
  grows), `src/mainview/components/PackageManagersSection.tsx`,
  `InstallProgressModal.tsx`
- `src/bun/tools/registry.ts` (provenance field), `src/bun/index.ts`
  (RPC: detect/search/install stream/resolve), `src/shared/types.ts`
- `src/mainview/components/ToolChooser.tsx`, `ToolsSection.tsx`,
  `SettingsPanel.tsx`, wizard step-2 components

## Edge cases

- Same package in multiple managers: show all, sorted by a manager
  preference order (user-arrangeable in Settings; default brew first on
  macOS).
- Install succeeds but the binary isn't on CLIDE's PATH (npm global bin
  dir, pipx shims): adapters return **absolute paths** from
  `resolveBinaries`; never depend on the login shell's PATH.
- Install output asking interactive questions: run non-interactive flags
  where the manager supports them (`HOMEBREW_NO_AUTO_UPDATE`,
  `npm --yes`-style); if input is still demanded, fail cleanly with the
  log visible rather than hanging.
- Custom-manager command templates are user input executed as
  subprocesses: argument-vector execution only (no shell interpolation of
  the search query), and the query string is passed as a single argv
  entry.
- Uninstall is **out of scope** — removing a tool from the registry keeps
  today's behavior and never uninstalls the package (say so in the remove
  confirm when provenance exists).

## Note

Vocabulary per ticket 96 ("task"). Builds directly on tickets 53/57/58/60;
no dependency on 97–102. Tool-choice tiering is coordinated with ticket
99's Native section (§2) — whichever lands second slots in without
rearranging the other.
