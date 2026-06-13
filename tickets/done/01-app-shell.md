# Ticket 01 — App Shell

## Goal
Set up the Electrobun application window, the IPC bridge between Bun (main process) and React (renderer), and the foundational layout regions.

## Acceptance criteria
- App launches with a single 1200×720 window, dark `#141414` background, no default chrome decorations visible
- Three layout regions are rendered: left sidebar (250px fixed), top bar (40px fixed), main thread area (fills remaining space)
- Electrobun RPC is wired up with a typed channel registry so main↔renderer calls are type-safe
- Dev mode uses Vite HMR; prod mode uses the built `dist/` bundle
- App name in menu bar: "CLIDE"

## Implementation notes

### Electrobun side (`src/bun/index.ts`)
- Create the main `BrowserView` window at 1200×720, centered, no traffic-light offset needed yet
- Set `minWidth: 900`, `minHeight: 600`
- Export an RPC channel object — every main↔renderer call goes through this rather than ad-hoc postMessage
- RPC channel types to stub (will be fleshed out in later tickets):
  - `listForms() → FormMeta[]`
  - `runForm(formId, values) → RunId`
  - `streamOutput(runId) → AsyncIterable<OutputChunk>`
  - `saveCredentials(provider, key) → void`
  - `getCredentials(provider) → string | null`

### React side (`src/mainview/App.tsx`)
- Replace the starter App with a three-region layout:
  ```
  <div class="flex h-screen bg-[#141414]">
    <Sidebar />           // 250px, shrink-0
    <div class="flex flex-col flex-1 min-w-0">
      <TopBar />
      <Thread />
    </div>
  </div>
  ```
- Each of `Sidebar`, `TopBar`, `Thread` should be stub components in their own files for now

### Tailwind
- Confirm `tailwind.config.js` includes `Inter` in the font-family stack
- Add CSS variable `--bg: #222121` and `--border: #3d3c3c` to `index.css`

## Files to create/modify
- `src/bun/index.ts` — main process setup
- `src/mainview/App.tsx` — root layout
- `src/mainview/components/Sidebar.tsx` — stub
- `src/mainview/components/TopBar.tsx` — stub
- `src/mainview/components/Thread.tsx` — stub
- `src/mainview/rpc.ts` — typed RPC client wrapper
- `tailwind.config.js` — font stack
- `src/mainview/index.css` — CSS variables
