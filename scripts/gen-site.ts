#!/usr/bin/env bun
/**
 * scripts/gen-site.ts
 * Generates the CLIDE marketing website into the docs/ folder.
 * Run with: bun run gen:site
 */
/// <reference types="bun" />

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Inline SVG icons (Lucide-style, 24×24 stroke). Kept as strings so the site
// stays a self-contained static bundle with no external requests.
// ---------------------------------------------------------------------------
function icon(paths: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const ICONS = {
  terminal: icon(
    `<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>`,
  ),
  layers: icon(
    `<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>`,
  ),
  clock: icon(
    `<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>`,
  ),
  sparkle: icon(
    `<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/>`,
  ),
  apple: icon(
    `<path d="M16 13c0 3 2 4 2 4-1 2-2 3-3.5 3S12 22 11 22s-1.5 1-3 1-3-2-4-4.5C2.5 15 3.5 11 7 11c1.5 0 2.5 1 3 1s1.5-1 3.5-1c1.5 0 2.5.7 3 1.5"/><path d="M12 7c0-2 1.5-4 3.5-4 .2 2-1.5 4-3.5 4z"/>`,
  ),
  windows: icon(
    `<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/>`,
  ),
  linux: icon(
    `<path d="M9 3c-1 1-1 3-1 4 0 2-3 4-3 8 0 3 3 6 7 6s7-3 7-6c0-4-3-6-3-8 0-1 0-3-1-4"/><circle cx="10" cy="8" r="0.6" fill="currentColor"/><circle cx="14" cy="8" r="0.6" fill="currentColor"/>`,
  ),
  network: icon(
    `<rect x="2" y="3" width="20" height="6" rx="1"/><rect x="2" y="15" width="20" height="6" rx="1"/><line x1="6" y1="6" x2="6" y2="6"/><line x1="6" y1="18" x2="6" y2="18"/><line x1="12" y1="9" x2="12" y2="15"/>`,
  ),
  plug: icon(
    `<path d="M9 2v6"/><path d="M15 2v6"/><path d="M7 8h10v3a5 5 0 0 1-10 0V8z"/><path d="M12 16v6"/>`,
  ),
  github: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-1.17-.02-2.13-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.72-1.54-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.41-5.27 5.7.41.36.78 1.07.78 2.15 0 1.56-.01 2.81-.01 3.19 0 .31.21.66.79.55A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z"/></svg>`,
};

// ---------------------------------------------------------------------------
// Content — edit here, not in the HTML template below.
// ---------------------------------------------------------------------------
const SITE = {
  name: "CLIDE",
  tagline: "Run Free",
  description:
    "Turn your computer into an <b>automation workhorse</b> — no coding required. CLIDE wraps shell scripts, SSH commands, web APIs, and AI models into clean tasks and workflows. Run anything, anywhere — no syntax, no servers, no SaaS lock-in.",
  // "CLIDE stands for Command Line Integration Development Environment. It is a desktop app that turns shell scripts into clean, fillable tasks. " +
  // "Run your tools without touching the terminal  just fill out the fields and hit Send.",
  siteUrl: "https://clide.tools",
  repoUrl: "https://github.com/kvnlnt/clide",
  features: [
    {
      icon: ICONS.terminal,
      title: "Tasks wrap scripts",
      body: "Every CLI tool gets a task with labeled fields. No flags, no syntax to remember.",
    },
    {
      icon: ICONS.layers,
      title: "Inline results",
      body: "Output streams directly into the card — text, tables, images, audio, video, and JSON all rendered in-place.",
    },
    {
      icon: ICONS.clock,
      title: "Projects & history",
      body: "Organize tasks into projects. Every run is recorded so you can review, re-run, or compare past results.",
    },
    {
      icon: ICONS.sparkle,
      title: "Any AI, any combination",
      body: "Mix and match models freely — local or remote, in any combination. Generate a task with Claude, draft a script with a private Ollama model, summarize results with OpenAI. Your stack, your call.",
    },
    {
      icon: ICONS.network,
      title: "Run local or remote",
      body: "Execute scripts on your own machine or on any server over SSH — same task, same workflow. Reach for the box that has the right tools, data, or horsepower.",
    },
    {
      icon: ICONS.plug,
      title: "Call any API",
      body: "Wrap HTTP endpoints alongside shell scripts. Local commands, remote hosts, and web APIs all become the same clean, fillable task.",
    },
  ],
  steps: [
    {
      n: "1",
      title: "Pick a task",
      body: "Open the command palette and choose any tool in your project.",
    },
    {
      n: "2",
      title: "Fill it in",
      body: "Type into clean, labeled fields — CLIDE maps them to script arguments.",
    },
    {
      n: "3",
      title: "See results inline",
      body: "Hit Send and watch output stream right into the card, ready to re-run.",
    },
  ],
  platforms: [
    { icon: ICONS.apple, label: "macOS" },
    { icon: ICONS.windows, label: "Windows" },
    { icon: ICONS.linux, label: "Linux" },
  ],
  automation: {
    heading: "The ultimate automation platform",
    body: "Local scripts, remote machines over SSH, web APIs, and any AI model — local or remote, in any combination. CLIDE wraps them all in the same clean task, so your computer becomes a control panel for everything you can run anywhere. No SaaS sprawl, no brittle glue code — automation you can actually read, run, and trust.",
    pillars: [
      {
        title: "Anything, anywhere",
        body: "Shell commands, SSH to remote hosts, HTTP APIs, and AI models all share one interface. Compose them however you like.",
      },
      {
        title: "Simpler",
        body: "No servers to babysit, no YAML pipelines, no dashboards. A folder of scripts is your whole platform.",
      },
      {
        title: "Auditable",
        body: "Plain-text scripts in version control and a full run history mean you can always see exactly what executed, when, and with which inputs.",
      },
      {
        title: "Yours",
        body: "It runs on your machine, talks to your servers, and uses your models. Your tools, your data, your rules — nothing leaves unless you send it.",
      },
    ],
  },
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

/* Sticky nav */
.nav {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(10,10,10,0.7);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #3d3c3c;
}

.nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
}

.nav-brand {
  font-weight: 800;
  letter-spacing: 0.02em;
  font-size: 0.95rem;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  font-size: 0.85rem;
}

.nav-links a {
  color: rgba(255,255,255,0.6);
  text-decoration: none;
  transition: color 0.2s;
}

.nav-links a:hover { color: #e8a020; }

.nav-github {
  display: inline-flex;
  align-items: center;
}

.nav-github svg {
  width: 18px;
  height: 18px;
}

/* Mobile menu toggle (CSS-only, no JS) */
.nav-toggle { display: none; }

.nav-burger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 30px;
  height: 30px;
  cursor: pointer;
}

.nav-burger span {
  display: block;
  height: 2px;
  width: 22px;
  background: rgba(255,255,255,0.7);
  border-radius: 2px;
  transition: transform 0.25s, opacity 0.25s;
}

@media (max-width: 640px) {
  .nav-burger { display: flex; }

  .nav-links {
    position: absolute;
    top: 52px;
    left: 0;
    right: 0;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    background: rgba(10,10,10,0.95);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid #3d3c3c;
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease;
  }

  .nav-links a {
    padding: 0.9rem 1.5rem;
    border-top: 1px solid #3d3c3c;
    font-size: 0.95rem;
  }

  .nav-toggle:checked ~ .nav-links {
    max-height: 320px;
  }

  /* Burger → X animation when open */
  .nav-toggle:checked ~ .nav-burger span:nth-child(1) {
    transform: translateY(7px) rotate(45deg);
  }
  .nav-toggle:checked ~ .nav-burger span:nth-child(2) {
    opacity: 0;
  }
  .nav-toggle:checked ~ .nav-burger span:nth-child(3) {
    transform: translateY(-7px) rotate(-45deg);
  }
}

/* Hero */
.hero {
  padding: 5rem 0 4rem;
  border-bottom: 1px solid #3d3c3c;
  background:
    radial-gradient(60% 60% at 70% 10%, rgba(200,134,10,0.18) 0%, transparent 60%),
    linear-gradient(180deg, #000000 0%, #6b3a17 80%);
}

.hero-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2.5rem;
  align-items: center;
}

.hero-name {
  font-size: clamp(2.5rem, 8vw, 4rem);
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
  font-size: clamp(1.1rem, 3vw, 1.3rem);
  font-weight: bold;
  display: inline-block;
  text-transform: uppercase;
  color: rgba(255,255,255,0.85);}

.hero-description {
  margin-top: 1.25rem;
  max-width: 560px;
  color: rgba(255,255,255,0.7);
  font-size: 0.95rem;
}

/* Hero app mockup (pure CSS) */
.mockup {
  background: #0a0a0a;
  border: 1px solid #3d3c3c;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  overflow: hidden;
}

.mockup-bar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 0.8rem;
  border-bottom: 1px solid #3d3c3c;
}

.mockup-dot { width: 10px; height: 10px; border-radius: 50%; }
.mockup-dot.r { background: #ff5f57; }
.mockup-dot.y { background: #febc2e; }
.mockup-dot.g { background: #28c840; }

.mockup-body { padding: 0.9rem 1rem 1.1rem; }

.mockup-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.72rem;
  color: rgba(255,255,255,0.55);
  margin-bottom: 0.55rem;
}

.mockup-check { color: #28c840; }

.mockup-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.35);
  margin-bottom: 0.3rem;
}

.mockup-field {
  background: rgba(217,217,217,0.05);
  border-radius: 4px;
  height: 26px;
  margin-bottom: 0.7rem;
}

.mockup-send {
  display: inline-block;
  background: #222121;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 3px;
  padding: 0.35rem 0.9rem;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #e8a020;
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
  transition: border-color 0.2s, transform 0.2s;
}

.feature-card:hover {
  border-color: #7a4a10;
  transform: translateY(-2px);
}

.feature-icon {
  width: 30px;
  height: 30px;
  margin-bottom: 0.85rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #e8a020;
  background: linear-gradient(135deg, rgba(200,134,10,0.18), rgba(59,26,8,0.25));
}

.feature-icon svg { width: 17px; height: 17px; }

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

/* How it works */
.how {
  padding: 4rem 0;
  border-bottom: 1px solid #3d3c3c;
}

.steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  counter-reset: step;
}

.step-num {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.9rem;
  color: #141414;
  background: linear-gradient(135deg, #e8a020, #c8860a);
  margin-bottom: 0.8rem;
}

.step-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: rgba(255,255,255,0.85);
  margin-bottom: 0.35rem;
}

.step-body {
  font-size: 0.85rem;
  color: rgba(255,255,255,0.45);
}

/* Automation platform */
.automation {
  padding: 4.5rem 0;
  border-bottom: 1px solid #3d3c3c;
  background:
    radial-gradient(70% 80% at 20% 0%, rgba(200,134,10,0.1) 0%, transparent 60%),
    #0a0a0a;
}

.automation-heading {
  font-size: clamp(1.5rem, 4vw, 2.2rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
  max-width: 620px;
  background: linear-gradient(45deg, #ffffff 0%, #e8a020 70%, #c8860a 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.automation-body {
  margin-top: 1.1rem;
  max-width: 600px;
  font-size: 1rem;
  color: rgba(255,255,255,0.6);
}

.pillars {
  margin-top: 2.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
}

.pillar {
  border-left: 2px solid #7a4a10;
  padding-left: 1rem;
}

.pillar-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #e8a020;
  margin-bottom: 0.35rem;
}

.pillar-body {
  font-size: 0.85rem;
  color: rgba(255,255,255,0.5);
}

/* Download */
.download {
  padding: 4rem 0;
  border-bottom: 1px solid #3d3c3c;
}

.download-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.download-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #222121;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 4px;
  padding: 0.6rem 1.2rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: rgba(255,255,255,0.45);
  cursor: default;
  transition: border-color 0.2s, color 0.2s;
}

.download-cta:hover {
  border-color: #7a4a10;
  color: rgba(255,255,255,0.7);
}

.download-cta svg { width: 16px; height: 16px; color: #e8a020; }

.download-note {
  margin-top: 0.9rem;
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

/* Responsive */
@media (max-width: 680px) {
  .hero-grid { grid-template-columns: 1fr; }
  .hero-mockup { order: -1; }
}

@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; }
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
          <div class="feature-icon">${f.icon}</div>
          <div class="feature-title">${f.title}</div>
          <p class="feature-body">${f.body}</p>
        </div>`,
    )
    .join("\n");

  const stepCards = SITE.steps
    .map(
      (s) => `
        <div class="step">
          <div class="step-num">${s.n}</div>
          <div class="step-title">${s.title}</div>
          <p class="step-body">${s.body}</p>
        </div>`,
    )
    .join("\n");

  const downloadButtons = SITE.platforms
    .map(
      (p) =>
        `<span class="download-cta">${p.icon}${p.label} — coming soon</span>`,
    )
    .join("\n        ");

  const pillars = SITE.automation.pillars
    .map(
      (p) => `
        <div class="pillar">
          <div class="pillar-title">${p.title}</div>
          <p class="pillar-body">${p.body}</p>
        </div>`,
    )
    .join("\n");

  // Inline SVG favicon (gold "C" mark) — self-contained, no extra file.
  const favicon =
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0a0a0a"/><text x="16" y="23" font-family="Inter,sans-serif" font-size="20" font-weight="800" text-anchor="middle" fill="#e8a020">C</text></svg>`,
    );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${SITE.description}" />
  <title>${SITE.name} — ${SITE.tagline}</title>
  <link rel="icon" href="${favicon}" />
  <link rel="canonical" href="${SITE.siteUrl}/" />
  <link rel="stylesheet" href="styles.css" />

  <!-- Social preview -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${SITE.name} — ${SITE.tagline}" />
  <meta property="og:description" content="${SITE.description}" />
  <meta property="og:url" content="${SITE.siteUrl}/" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${SITE.name} — ${SITE.tagline}" />
  <meta name="twitter:description" content="${SITE.description}" />
</head>
<body>

  <!-- Nav -->
  <header class="nav">
    <div class="container nav-inner">
      <span class="nav-brand">${SITE.name}</span>
      <input type="checkbox" id="nav-toggle" class="nav-toggle" />
      <label for="nav-toggle" class="nav-burger" aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </label>
      <nav class="nav-links">
        <a href="#features">Features</a>
        <a href="#how">How it works</a>
        <a href="#automation">Platform</a>
        <a href="#download">Download</a>
        <a class="nav-github" href="${SITE.repoUrl}" target="_blank" rel="noopener noreferrer" aria-label="GitHub">${ICONS.github}</a>
      </nav>
    </div>
  </header>

  <!-- Hero -->
  <section class="hero">
    <div class="container hero-grid">
      <div class="hero-copy">
        <h1 class="hero-name">${SITE.name}</h1>
        <p class="hero-tagline">${SITE.tagline}</p>
        <p class="hero-description">${SITE.description}</p>
      </div>
      <div class="hero-mockup">
        <div class="mockup">
          <div class="mockup-bar">
            <span class="mockup-dot r"></span>
            <span class="mockup-dot y"></span>
            <span class="mockup-dot g"></span>
          </div>
          <div class="mockup-body">
            <div class="mockup-row"><span class="mockup-check">✓</span> resize-image &nbsp;·&nbsp; 12:04</div>
            <div class="mockup-label">Source file</div>
            <div class="mockup-field"></div>
            <div class="mockup-label">Width (px)</div>
            <div class="mockup-field"></div>
            <span class="mockup-send">SEND ›</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Features -->
  <section class="features" id="features">
    <div class="container">
      <p class="section-heading">Features</p>
      <div class="features-grid">
        ${featureCards.trim()}
      </div>
    </div>
  </section>

  <!-- How it works -->
  <section class="how" id="how">
    <div class="container">
      <p class="section-heading">How it works</p>
      <div class="steps">
        ${stepCards.trim()}
      </div>
    </div>
  </section>

  <!-- Automation platform -->
  <section class="automation" id="automation">
    <div class="container">
      <p class="section-heading">More than a launcher</p>
      <h2 class="automation-heading">${SITE.automation.heading}</h2>
      <p class="automation-body">${SITE.automation.body}</p>
      <div class="pillars">
        ${pillars.trim()}
      </div>
    </div>
  </section>

  <!-- TODO(ticket-16): wire up real download/install details -->
  <section class="download" id="download">
    <div class="container">
      <p class="section-heading">Download</p>
      <div class="download-buttons">
        ${downloadButtons}
      </div>
      <p class="download-note">Installation instructions coming soon.</p>
    </div>
  </section>

  <!-- Footer -->
  <footer class="footer">
    <div class="container">
      <p class="footer-text">
        &copy; ${year} Kevin Lint &amp; Lint Trap Media. All rights reserved. &mdash;
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
const outDir = join(import.meta.dir, "..", "docs");
await mkdir(outDir, { recursive: true });

const files: { name: string; content: string }[] = [
  { name: "index.html", content: buildHtml() },
  { name: "styles.css", content: css },
  // Tell GitHub Pages to serve files as-is (skip Jekyll processing).
  { name: ".nojekyll", content: "" },
  // Custom domain for GitHub Pages — see https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site
  { name: "CNAME", content: "clide.tools\n" },
];

for (const file of files) {
  const dest = join(outDir, file.name);
  await Bun.write(dest, file.content);
  console.log(`  wrote  ${dest}`);
}

console.log(`\nSite generated → ${outDir}`);
