# Ticket 15 — Auto-Generated Marketing Website

## Goal

Add a `package.json` script that generates a very basic static marketing website
for CLIDE into a top-level `www/` folder. Running the script produces a
self-contained, ready-to-serve site (no build step, no framework) describing the app
and pointing users to a download/install section.

## Background

CLIDE is the desktop CLI Development Environment built with Electrobun + React +
Tailwind (see [tickets/00-overview.md](00-overview.md)). The product currently has no
public landing page. This ticket introduces a minimal generated site so there is a
single command — `bun run gen:site` — that (re)builds the marketing page from a small
generator script, keeping the page content in source control and trivially diffable.

The site is intentionally **basic**: static HTML + a single CSS file, no bundler, no
JS framework, no external network dependencies. It should open correctly by simply
double-clicking `www/index.html` or serving the folder with any static file server.

## Acceptance criteria

### Script

- A new `package.json` script `gen:site` runs the generator with Bun
  (e.g. `"gen:site": "bun run scripts/gen-site.ts"`).
- Running `bun run gen:site` creates the `www/` folder if missing and writes the site
  files into it (overwriting prior generated output).
- The script is idempotent: running it twice yields identical output.
- The script prints a short summary on completion (files written + output path).
- The script exits non-zero on a write failure.

### Generated output (`www/`)

- `www/index.html` — a single landing page containing, in order:
  1. **Header / hero**: app name "CLIDE", a one-line tagline, and a short description
     drawn from the app metaphor ("everything is a form").
  2. **Features** section: 3–5 short bullet/feature blocks summarizing core value
     (forms wrap scripts, inline results, projects, AI form creation, grid view).
  3. **Download / Install** section — **placeholder only** (see below).
  4. **Footer**: copyright line with the current year and a link back to the repo.
- `www/styles.css` — a single small stylesheet (dark theme consistent with the app's
  visual language: bg `#141414`, surface `#0a0a0a`, border `#3d3c3c`, Inter font,
  white text at varying opacities).
- The page is responsive enough to be readable on mobile widths (basic max-width
  container + relative units); no media-query heroics required.
- Valid, self-contained HTML5: no external CSS/JS/CDN references, no inline framework
  runtime. Local relative reference to `styles.css` only.

### Download / Install section (PLACEHOLDER)

- Render a clearly-labeled **Download** section with heading and a single placeholder
  call-to-action (e.g. a disabled-looking "Download for macOS — coming soon" button or
  a short "Installation instructions coming soon." note).
- Add an HTML comment marking it as a placeholder, e.g.
  `<!-- TODO(ticket-16): wire up real download/install details -->`, so the follow-up
  ticket can find and replace it.
- Do **not** invent download URLs, version numbers, file sizes, or install commands —
  the real content is being defined in a separate ticket.

## Content source

- Keep the page copy (tagline, feature list, footer text) in a small typed data
  object at the top of the generator script so edits are made in one place rather than
  scattered through HTML strings.
- Derive the footer year from `new Date().getFullYear()` at generation time.

## Files to create / modify

- `scripts/gen-site.ts` — **new**, the generator (plain Bun/TypeScript; writes the
  files using `Bun.write`).
- `package.json` — add the `gen:site` script.
- `www/` — **generated output**, not authored by hand. Add `www/` to `.gitignore`
  unless the team prefers to commit the generated artifact (call this out in review).

## Out of scope

- The actual download/install content, hosted binaries, version detection, or install
  commands — **tracked in a separate follow-up ticket** (the Download section here is
  only a placeholder).
- Any bundler, framework, CSS preprocessor, or JS interactivity.
- Deployment/hosting, CI publishing, custom domains, analytics, or SEO metadata beyond
  a basic `<title>` and `<meta name="description">`.
- Multi-page site, blog, or docs.

## Notes

- The generator should be dependency-free (only Bun built-ins) so it runs without extra
  installs and stays fast.
- Match the app's dark visual language so the site feels consistent with CLIDE, but do
  not over-design — "very basic" is the explicit target.
