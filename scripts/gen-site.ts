#!/usr/bin/env bun
/**
 * scripts/gen-site.ts
 * Generates the CLIDE marketing website into the www/ folder.
 * Run with: bun run gen:site
 */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Content — edit here, not in the HTML template below.
// ---------------------------------------------------------------------------
const SITE = {
  name: "CLIDE",
  tagline: "Harness your power.",
  description:
    "CLIDE stands for Command Line Integration Development Environment. It is a desktop app that turns shell scripts into clean, fillable forms. " +
    "Run your tools without touching the terminal — just fill out the form and hit Send.",
  repoUrl: "https://github.com/linttrapmedia/clide",
  features: [
    {
      title: "Forms wrap scripts",
      body: "Every CLI tool gets a form with labeled fields. No flags, no syntax to remember.",
    },
    {
      title: "Inline results",
      body: "Output streams directly into the card — text, tables, images, audio, video, and JSON all rendered in-place.",
    },
    {
      title: "Projects & history",
      body: "Organize forms into projects. Every run is recorded so you can review, re-run, or compare past results.",
    },
    {
      title: "AI form creation",
      body: "Describe what you need and CLIDE generates the form and the script for you. Works with Claude, OpenAI, and local Ollama models.",
    },
  ],
};

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------
const css = `
/* CLIDE — marketing site styles */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #141414;
  color: rgba(255,255,255,0.9);
  font-family: Inter, system-ui, -apple-system, sans-serif;
  font-size: 16px;
  line-height: 1.6;
}

/* Gradient accent — black > dark brown > gold */
.grad {
  background: linear-gradient(135deg, #000000 0%, #3b1a08 45%, #c8860a 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

a { color: inherit; }

.container {
  max-width: 780px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* Hero */
.hero {
  padding: 5rem 0 4rem;
  border-bottom: 1px solid #3d3c3c;
  background: linear-gradient(180deg, #000000 0%, #6b3a17 80%);
}

.hero-name {
  font-size: clamp(2.5rem, 8vw, 6rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: rgba(255,255,255,0.95);
  background: linear-gradient(45deg, #d5d0bc 0%, #e8a020 60%, #c8860a 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-tagline {
  margin-top: 1rem;
  font-size: clamp(1.1rem, 3vw, 2rem);
  font-weight: bold;
  display: inline-block;
  text-transform: uppercase;
  color: rgba(255,255,255,0.85);}

.hero-description {
  margin-top: 1.25rem;
  max-width: 560px;
  color: rgba(255,255,255,0.55);
  font-size: 0.95rem;
}

/* Features */
.features {
  padding: 4rem 0;
  border-bottom: 1px solid #3d3c3c;
}

.section-heading {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
  margin-bottom: 2rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.feature-card {
  background: #0a0a0a;
  border: 1px solid #3d3c3c;
  border-radius: 5px;
  padding: 1.25rem 1.5rem;
  transition: border-color 0.2s;
}

.feature-card:hover {
  border-color: #7a4a10;
}

.feature-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: rgba(255,255,255,0.85);
  margin-bottom: 0.4rem;
}

.feature-body {
  font-size: 0.875rem;
  color: rgba(255,255,255,0.45);
}

/* Download */
.download {
  padding: 4rem 0;
  border-bottom: 1px solid #3d3c3c;
}

.download-cta {
  margin-top: 1.5rem;
  display: inline-block;
  background: #222121;
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 3px;
  padding: 0.6rem 1.4rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: rgba(255,255,255,0.35);
  cursor: default;
}

.download-note {
  margin-top: 0.75rem;
  font-size: 0.8rem;
  color: rgba(255,255,255,0.25);
}

/* Footer */
.footer {
  padding: 2.5rem 0;
}

.footer-text {
  font-size: 0.8rem;
  color: rgba(255,255,255,0.25);
}

.footer-text a {
  text-decoration: underline;
  text-underline-offset: 3px;
  color: rgba(255,255,255,0.4);
}

.footer-text a:hover {
  color: rgba(255,255,255,0.7);
}
`.trim();

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------
function buildHtml(): string {
  const year = new Date().getFullYear();
  const featureCards = SITE.features
    .map(
      (f) => `
        <div class="feature-card">
          <div class="feature-title">${f.title}</div>
          <p class="feature-body">${f.body}</p>
        </div>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${SITE.description}" />
  <title>${SITE.name} — ${SITE.tagline}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>

  <!-- Hero -->
  <section class="hero">
    <div class="container">
      <h1 class="hero-name">${SITE.name}</h1>
      <p class="hero-tagline">${SITE.tagline}</p>
      <p class="hero-description">${SITE.description}</p>
    </div>
  </section>

  <!-- Features -->
  <section class="features">
    <div class="container">
      <p class="section-heading">Features</p>
      <div class="features-grid">
        ${featureCards.trim()}
      </div>
    </div>
  </section>

  <!-- TODO(ticket-16): wire up real download/install details -->
  <section class="download">
    <div class="container">
      <p class="section-heading">Download</p>
      <div class="download-cta">Download for macOS — coming soon</div>
      <p class="download-note">Installation instructions coming soon.</p>
    </div>
  </section>

  <!-- Footer -->
  <footer class="footer">
    <div class="container">
      <p class="footer-text">
        &copy; ${year} ${SITE.name} &mdash;
        <a href="${SITE.repoUrl}" target="_blank" rel="noopener noreferrer">GitHub</a>
      </p>
    </div>
  </footer>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------
const outDir = join(import.meta.dir, "..", "www");
await mkdir(outDir, { recursive: true });

const files: { name: string; content: string }[] = [
  { name: "index.html", content: buildHtml() },
  { name: "styles.css", content: css },
];

for (const file of files) {
  const dest = join(outDir, file.name);
  await Bun.write(dest, file.content);
  console.log(`  wrote  ${dest}`);
}

console.log(`\nSite generated → ${outDir}`);
