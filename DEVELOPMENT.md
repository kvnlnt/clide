# Development

> **PROPRIETARY AND CONFIDENTIAL.** Copyright (c) 2026 Kevin Lint and Lint Trap
> Media. All Rights Reserved. See [LICENSE](LICENSE) for full terms.

CLIDE is an Electrobun desktop app built with React, Tailwind CSS, and Vite for
hot module replacement (HMR).

## Getting Started

```bash
# Install dependencies
bun install

# Development without HMR (uses bundled assets)
bun run dev

# Development with HMR (recommended)
bun run dev:hmr

# Build for production
bun run build

# Build for production release
bun run build:prod
```

## How HMR Works

When you run `bun run dev:hmr`:

1. **Vite dev server** starts on `http://localhost:5173` with HMR enabled
2. **Electrobun** starts and detects the running Vite server
3. The app loads from the Vite dev server instead of bundled assets
4. Changes to React components update instantly without full page reload

When you run `bun run dev` (without HMR):

1. Electrobun starts and loads from `views://mainview/index.html`
2. You need to rebuild (`bun run build`) to see changes

## Project Structure

```
├── src/
│   ├── bun/
│   │   └── index.ts        # Main process (Electrobun/Bun)
│   └── mainview/
│       ├── App.tsx         # React app component
│       ├── main.tsx        # React entry point
│       ├── index.html      # HTML template
│       └── index.css       # Tailwind CSS
├── electrobun.config.ts    # Electrobun configuration
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind configuration
└── package.json
```

## Customizing

- **React components**: Edit files in `src/mainview/`
- **Tailwind theme**: Edit `tailwind.config.js`
- **Vite settings**: Edit `vite.config.ts`
- **Window settings**: Edit `src/bun/index.ts`
- **App metadata**: Edit `electrobun.config.ts`

## Dev Profiles

`bun run dev:hmr` always uses your real dev app-data
(`~/Library/Application Support/dev.clide`), which accumulates whatever
you've been testing. To boot into a realistic, repeatable scenario instead,
use one of the profile scripts — each seeds an isolated app-data dir
(`dev.clide-profiles/<name>`, never touching your real data) with a
persona-shaped set of projects, forms, run history, AI services, views, and
schedules, then launches HMR against it:

| Script                    | Persona     | What's seeded                                                                          |
| ------------------------- | ----------- | --------------------------------------------------------------------------------------- |
| `bun run dev:hmr:newbie`  | First launch | Nothing — no projects, no AI service. Exercises the first-run onboarding takeovers.     |
| `bun run dev:hmr:beginner`| A week in    | 2 projects, a few forms each, 1 AI service, a dozen runs, no views/schedules.           |
| `bun run dev:hmr:regular` | Comfortable  | 4 projects, ~5 forms each, 2 AI services, a few views per project, upcoming schedules, ~60 runs/project. |
| `bun run dev:hmr:power`   | Heavy daily  | 16 projects (some with 25+ forms), many views (some hidden), dozens of schedules, ~150+ runs/project. |
| `bun run dev:hmr:edge`    | Chaos        | Emoji/CJK/very-long project names, a form with a missing script, an orphaned schedule, 45 chips stacked on one calendar day. |

Each run **resets and reseeds from scratch** by default, so you always start
from the same known state. To keep whatever a profile's last run left behind
(e.g. after you've made manual changes you want to preserve), prefix with
`CLIDE_PROFILE_KEEP=1`:

```bash
CLIDE_PROFILE_KEEP=1 bun run dev:hmr:regular
```

To seed a profile without launching the app, run
`CLIDE_PROFILE=<name> bun run seed:profile` directly.

## Marketing Site

The marketing website is generated from a self-contained script:

```bash
# Generate the static site into docs/
bun run gen:site

# Open the generated site
bun run site
```

Edit content in the `SITE` object at the top of `scripts/gen-site.ts`.
