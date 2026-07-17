# Ticket 79 — Dev Profiles: Launch as a Realistic User Persona

## Goal

Today there is one dev entry point — `bun run dev:hmr` — which always runs
against whatever state has accumulated in the real app-data dir
(`~/Library/Application Support/dev.clide`). To develop and test against
real-life scenarios, add **profile-based launch scripts** so a single
`bun run` command boots CLIDE as a specific *kind* of user, with seeded data
to match — reliably and repeatably.

## Acceptance criteria

### Mechanism

- A `CLIDE_PROFILE=<name>` env var makes [paths.ts](../src/bun/paths.ts)
  resolve the app-data root to a profile-scoped dir (e.g.
  `~/Library/Application Support/dev.clide-profiles/<name>`) so profiles
  are fully isolated from each other **and** from the real dev data.
  Unset = current behavior, untouched.
- A seeding script (`scripts/seed-profile.ts`) populates a profile dir from
  fixture definitions: projects (created under a scratch folder like
  `~/.clide-profiles/<name>/projects/…` with their `.clide` folders),
  forms, views, run history rows, schedules, and AI-service config.
  Seeding is **reset-on-launch by default** (wipe + reseed) so every run
  starts from the same known state; a `CLIDE_PROFILE_KEEP=1` escape hatch
  skips the reseed when you want state to persist across restarts.
- `package.json` gains one script per profile, all shaped like
  `dev:hmr:<profile>` = seed + `CLIDE_PROFILE=<name> bun run dev:hmr`.
- AI services in fixtures must not require real API keys: seed local/Ollama
  style entries, or a dummy remote entry, so nothing secret lands in the
  repo. (Profiles that *should* exercise "no AI" simply seed none.)

### Suggested profile spread

| Script                  | Persona        | Seeded state                                                                                                                                                    | Exercises                                                                 |
| ----------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------| ------------------------------------------------------------------------- |
| `dev:hmr:newbie`        | First launch   | **Nothing.** No projects, no AI service, no history.                                                                                                            | Tickets 76/78 onboarding, empty states                                    |
| `dev:hmr:beginner`      | A week in      | 2 projects, 3–4 forms each, 1 AI service, a dozen runs, no views/schedules                                                                                       | Basic thread, small sidebar, first-view discovery                          |
| `dev:hmr:regular`       | Comfortable    | 4–5 projects, ~10 forms each, 2 AI services, 2–3 views per project, a few schedules, a few hundred runs incl. failures/cancelled                                | Views, calendar, filter chips, status variety                              |
| `dev:hmr:power`         | Heavy daily    | 15+ projects, 25+ forms in the big ones, many views (some hidden/pinned), dozens of schedules incl. recurring, thousands of runs across months, event-bus chains | List overflow, ticket 77 search, calendar density, scroll/perf, grouping   |
| `dev:hmr:edge`          | Chaos          | Pathological data: emoji/CJK/very-long names, deep folder paths, forms whose scripts are missing/broken, orphaned schedules, 40+ chips on one calendar day       | Truncation, error states, "+N more" overflows, resilience                  |

(`dev:hmr` itself stays exactly as-is — real data, no profile.)

### Docs

- A short section in `DEVELOPMENT.md` listing the profiles, what each is
  for, and the keep/reset behavior.

## Files to modify

- `package.json` (scripts)
- `src/bun/paths.ts` (profile-aware root)
- `scripts/seed-profile.ts` + `scripts/profiles/<name>.ts` fixtures (new)
- `DEVELOPMENT.md`

## Edge cases

- Run-history SQLite: the seeder must write rows the app's schema/loader
  accepts — reuse the real `db/history.ts` layer rather than hand-writing
  SQL, so schema drift can't silently rot fixtures.
- Seeded run timestamps should be *relative to now* (e.g. "3 days ago") so
  the thread's date grouping and the calendar always look alive regardless
  of when you run the profile.
- Keychain: don't write real credentials; if a seeded remote service needs
  a key present to be considered "configured," use an obviously fake value
  and keep it out of any code path that would actually call the provider.
