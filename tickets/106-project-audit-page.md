# Ticket 106 — Project Audit Page & RSI Loop (Epic)

## Goal

Every project gets an **Audit** page: a surface that analyzes the project's
tasks and workflows against their actual run record and proposes concrete
improvements. Five layers make it work:

1. **Audit log** — task/workflow activity, statuses, and their
   relationships recorded in a queryable, structured form.
2. **Self-documentation** — the project, its tasks, and its workflows can
   be introspected into one structured document fit for feeding an AI.
3. **Reflection facts** — the same telemetry emitted as **logic facts**
   (Datalog), the ground truth a theorem prover can evaluate against.
4. **Hypothesis loop & theorem store** — the AI proposes process
   improvements as _falsifiable logic programs_; a first-party Datalog
   engine tests them against real run facts; confidence-scored theorems
   accumulate — confirmed **and** refuted.
5. **AI prescription** — the AI reads the dossier + theorem store and
   proposes a prescribed set of changes (new tasks, task edits, new/edited
   workflows) that the user can accept **wholesale or pick apart item by
   item** — each accepted item materializes through the app's normal
   creation machinery.

Governing principle: **the AI proposes; the logic engine verifies;
telemetry is ground truth.** An LLM suggestion ("cache step X") is a vibe;
the same claim written as a logic query over run history is a testable
statement returning yes/no with bindings. The model never grades its own
suggestions in natural language, and refuted theorems stop it from
re-proposing dead ideas. Every layer is plain text — facts, hypotheses,
and theorems are greppable, diffable, and versionable alongside the
workflows they describe.

This is an epic; natural grooming split: log, introspection doc, page +
report, proposal application, facts + engine, hypothesis loop + theorem
store, interventions.

## Acceptance criteria

### 1. Audit log

- `src/bun/db/auditLog.ts`: an append-only `audit_log` table per project
  db (additive, [migrations.ts](../src/bun/db/migrations.ts) pattern):
  timestamped events — task run started/finished (status, duration,
  version per ticket 105, triggeredBy), workflow run started/finished,
  per-step outcomes (succeeded/failed/skipped + reason), schedule fires,
  definition changes (task created/adopted/versioned, workflow
  created/edited/duplicated).
- Emitters hook the existing seams: [execute.ts](../src/bun/runner/execute.ts),
  [workflows/engine.ts](../src/bun/workflows/engine.ts) +
  [runStore.ts](../src/bun/workflows/runStore.ts),
  [scheduler.ts](../src/bun/scheduler.ts), forms writer. Logging is
  fire-and-forget — a log failure never fails a run.
- Queryable via RPC with time-range + entity filters; the audit page's
  report and the AI feed both read from it. (Much already lives in
  `history.db` runs — the log _references_ run ids rather than duplicating
  payloads.)

### 2. Self-documentation & introspection

- `src/bun/audit/introspect.ts`: `describeProject(projectPath)` produces a
  structured **Project Dossier** (JSON + a rendered markdown view): project
  profile (ticket 101, when present), every task (name, description,
  version/lifecycle, fields, tool/command shape, output definitions,
  schedules), every workflow (steps, triggers, task references + pinned
  versions), and aggregated log stats (run counts, failure rates, mean
  duration, last-30-days trend, dead tasks never run, workflows that
  always fail at the same step).
- Tasks and workflows get a `docs?: string` self-description field
  (AI-drafted at creation time going forward, editable) so the dossier
  reads as intent, not just structure. Missing docs are themselves an
  audit finding.
- The dossier is deterministic and versionable — same project state, same
  dossier — so audits are comparable over time.

### 3. Reflection facts — telemetry as logic

- Run telemetry is exposed as **logic facts**, not JSON blobs:

  ```prolog
  workflow(agr_pipeline).
  step(agr_pipeline, transcode, 3).
  step_ran(run_42, transcode, 84.2, exit_0).
  used_input(run_42, transcode, sha256_ab3f).
  triggered_by(run_42, manual).
  workflow_duration(run_42, 96.7).
  ```

- `src/bun/rsi/facts.ts`: facts land in a `facts` table in the project db
  (`bun:sqlite`, additive migration) with an **INSERT-only discipline
  enforced by triggers** (`BEFORE UPDATE`/`BEFORE DELETE` →
  `RAISE(ABORT)`), WAL mode for read-during-run. **Append-only is a hard
  invariant** — it is what makes theorem confidence recomputable and
  auditable (§5).
- Facts are emitted from the same seams as the audit log (§1) —
  execute.ts, workflows engine/runStore, scheduler — fire-and-forget; a
  fact-write failure never fails a run. Standalone task runs emit facts
  too (task-vocabulary predicates — the facts store is brand-new, so
  ticket 96's form-on-disk rule doesn't apply; final predicate vocabulary
  fixed at grooming). Input references are **hashes**
  (`sha256_…`), never raw values, consistent with the ticket-98 secret
  rule.
- A **plain-text export** (`.pl` facts or JSONL — decide during
  implementation) is appended per workflow into the project folder so
  facts stay greppable and git-diffable. SQLite is the source of truth;
  the text export is the audit surface.
- Raw facts are queryable via RPC (time-range + predicate filters).

### 4. Logic engine & validator — first-party, zero-dependency

- The inference engine is the **trust anchor** of the whole loop — it must
  be as auditable as the theorems it produces. No tau-prolog, no external
  logic library: CLIDE ships its own ~300–500 LOC Datalog engine in
  `src/bun/rsi/engine/`:
  - `term.ts` — tagged-union terms (`var` / `atom` / `num` / flat
    `compound` for facts and goals only — no nesting; the Datalog
    restriction).
  - `unify.ts` — unification over substitution maps (μKanren-style);
    occurs-check-free by construction since Datalog terms don't nest.
  - `parse.ts` — Prolog-shaped surface syntax (`head :- body.`, facts,
    comparison builtins `>` `<` `>=` `=<` `=` `\=`, arithmetic on bound
    values) with Datalog semantics. **The parser is the first validator
    layer**: function symbols, nested compounds, lists, and cut are
    unparseable, not merely rejected.
  - `stratify.ts` — dependency-graph stratification check; unstratified
    negation is rejected (second validator layer).
  - `eval.ts` — **semi-naive bottom-up evaluation to fixpoint**: guaranteed
    termination on the restricted language and clause-order independence,
    so AI-generated programs can't be order-sensitive.
  - `builtins.ts` — comparisons + arithmetic over bound variables only
    (unbound-variable arithmetic is a validation error).
- Validator whitelist: programs may only reference the §3 fact schema
  (plus the §5 theorem-store projection) and their own derived predicates
  — anything else (I/O, extralogical builtins, unknown predicates) is
  rejected before evaluation.
  **Machine-generated programs never run unvetted**; this is the safety
  boundary for unattended loop execution.
- **Isolation**: each evaluation runs in a Bun `Worker` with a hard
  wall-clock timeout (belt and suspenders over the termination guarantee);
  worker crash/timeout logs an automatic disconfirmation event against the
  hypothesis.
- A **golden-test suite** (known fact sets + programs → expected result
  sets) ships with the engine — its own audit trail and a merge
  requirement.
- All inference lives in the Bun process; the webview is display-only and
  talks over the existing RPC. No inference in the renderer, no telemetry
  writes from the renderer.

### 5. Hypothesis loop, confidence & theorem store

- `src/bun/rsi/hypotheses.ts` + a prompt pipeline in `src/bun/ai/`: the AI
  reads recent facts (plus refuted-theorem constraints) and returns, per
  suggestion: (a) a natural-language improvement, (b) a **logic program**
  encoding the hypothesis, (c) a **disconfirming query** — what would be
  true if the hypothesis is wrong. **No falsifier, no test** — suggestions
  that can't state their own disconfirmation are rejected before
  evaluation. The prompt documents the restricted grammar (no lists, no
  nested terms, no recursion through negation, no cut). Example (note:
  programs may only use §3 schema predicates + their own derived heads —
  durations and inputs are keyed by **run**, not workflow):

  ```prolog
  % Hypothesis: 'transcode' dominates its runs' wall time
  bottleneck(R, S) :-
      step_ran(R, S, D, _),
      workflow_duration(R, T),
      D > T * 0.6.

  % Caching helps only if inputs actually repeat across runs
  cache_effective(S) :-
      used_input(R1, S, H),
      used_input(R2, S, H),
      R1 \= R2.
  ```

- **Two-phase testing**: _retrodiction_ (evaluate against the historical
  fact log) then _prediction_ (re-evaluate as new live runs land). A
  hypothesis that fits history but fails the next N live runs is
  overfitting — demote it.
- **Confidence**: per-theorem Beta distribution — cheap, auditable, no ML
  infra. Start Beta(1, 1); confirming run → α += 1, disconfirming →
  β += 1; confidence = α / (α + β). **Promotion rule**: confidence > 0.9
  AND trial count > N (configurable, default 20).
- `src/bun/rsi/theorems.ts`: the theorem store is a table in the project
  db, projected as facts the engine can reason over. The projection is
  **flat** — the claim can't nest inside `theorem/5` because §4's parser
  rejects nested compounds by design; the claim's head/args get their own
  predicate:

  ```prolog
  theorem(t_017, confirmed, 0.94, 31, '2026-07-12').
  theorem_claim(t_017, bottleneck, transcode).
  theorem(t_018, refuted, 0.12, 15, '2026-07-14').
  theorem_claim(t_018, cache_effective, transcode).
  supersedes(t_022, t_017).   % environment changed; retired, not deleted
  ```

  **Refuted theorems are retained** and injected into the hypothesis
  prompt as negative constraints. Theorems carry validity windows;
  confidence decays or re-tests after age/environment-change events —
  the environment fingerprint is a fact hashing the workflow definition +
  resolved tool versions from the tool registry (CLIDE projects have no
  lockfile). `supersedes/2` retires without deleting.

- **Recompute audit**: any theorem's confidence must be recomputable from
  scratch from the append-only fact log; a "Recompute" action does exactly
  that and flags mismatches as a memory-corruption alarm.

### 6. Audit page

- `"audit"` joins the project surfaces
  ([AppContext.tsx](../src/mainview/context/AppContext.tsx)); button on
  [ProjectToolbar.tsx](../src/mainview/components/ProjectToolbar.tsx)
  (Lucide `ClipboardCheck`/`Stethoscope`), full-width page per ticket-39
  conventions.
- Top: **health report** rendered from the dossier's stats — failure-rate
  leaders, never-run tasks, flaky workflow steps, schedule misfires — each
  finding linking to the task/workflow it concerns. Useful _without_ AI.
- A **Theorems** section: confirmed/refuted/superseded theorems with
  claim, confidence, trial count, provenance tag (observational vs
  interventional, §8), and confidence history; pending hypotheses awaiting
  live-prediction trials; the recompute-audit action (§5). Empty until the
  RSI layers land — the section hides when no fact log exists.
- **"Run audit"** button: sends the dossier (+ recent log window +
  theorem store when present) to the default AI service with a
  structured-output prompt; requires an AI service, disabled with
  explanation otherwise. Progress + failure states per ticket-74
  conventions. Past audits are persisted per project and browsable (date,
  model, findings count).

### 7. AI proposals & application (the commit gate)

- The AI returns a typed proposal set, each item one of:
  `create-task` (a full spec, ticket-22 shape), `edit-task` (target slug +
  changed spec → materializes as a **new version** via ticket 105),
  `create-workflow` / `edit-workflow` (definition), `retire` (suggest
  disabling/removing something unused), `run-experiment` (an A/B trial,
  §8), plus a human `rationale` per item.
- **Evidence-backed rationale**: a proposal derived from a confirmed
  theorem cites it (id + confidence + trial count) in its card; the
  prescription prompt receives confirmed theorems as evidence and refuted
  ones as negative constraints. Uncited proposals are allowed but visually
  marked "unverified".
- Review UI: proposal cards with rationale, expandable detail (diff-style
  for edits), per-item Accept/Reject checkboxes, **Accept all** for the
  wholesale case, then one Apply action.
- Applying routes through existing machinery — task creation via the
  spec path (`generateFormFromSpec` — `generateTaskFromSpec` after
  ticket 96), workflow saves via
  [store.ts](../src/bun/workflows/store.ts), task edits through the
  versioning flow **including ticket 105's retroactive-upgrade dialog**.
  Accepted tasks arrive as _drafts_ (lifecycle per 105) — the AI never
  ships adopted/locked artifacts. Nothing is deleted by `retire`; it only
  disables or flags.
- **Theorems only ever suggest.** Promoting a theorem into an actual
  workflow edit goes through this same review flow — human approval is
  non-negotiable in v1. This is the Goodhart guard: "skip the verification
  step" genuinely does reduce duration.
- Partial-failure honesty: if item 3 of 5 fails to apply, the report shows
  per-item outcomes; nothing rolls back silently.

### 8. Interventions — correlation → causation

- Run history is observational; "runs after 6pm are slower" may be network
  congestion, not the workflow. The system may propose **cheap A/B trials
  scheduled through CLIDE's own scheduler** ("next 5 runs with caching on,
  5 off") — surfaced as `run-experiment` proposal items through §7's
  review flow, never auto-scheduled.
- Every theorem carries a provenance tag, `observational` or
  `interventional`; the theorem browser (§6) and the prescription prompt
  (§7) distinguish them.

## Failure modes designed against

- Goodhart's loop (optimizing metrics degenerately) → human commit gate (§7)
- Overfitting to history → retrodiction + live prediction (§5)
- Observational confounding → interventional A/B trials + provenance tags (§8)
- Stale knowledge → validity windows, decay, `supersedes/2` (§5)
- Runaway/non-terminating generated code → Datalog validator + Worker timeout (§4)
- Memory corruption/drift → append-only facts + recompute-from-scratch audit (§5)
- AI re-proposing refuted ideas → refuted theorem set as prompt constraints (§5)

## Files to modify

- New: `src/bun/db/auditLog.ts`, `src/bun/audit/introspect.ts`,
  `src/bun/ai/auditProposals.ts`, `src/bun/rsi/` (`facts.ts`,
  `hypotheses.ts`, `theorems.ts`, `engine/` per §4 + golden-test suite,
  evaluation worker), `src/mainview/components/audit/AuditPage.tsx`
  (+ report/proposal/theorem subcomponents)
- `src/shared/types.ts` (events, dossier, proposals, theorems, RPC),
  `src/bun/index.ts`, emitter seams listed in §1/§3, `ProjectToolbar.tsx`,
  `AppContext.tsx`, wizard/save paths for the `docs` field,
  `src/bun/scheduler.ts` (A/B trial scheduling)

## Edge cases

- Young project, thin log: the report says so ("not enough history to
  audit meaningfully — come back after N runs") instead of hallucinating
  findings; AI audit still allowed but the prompt states the sparsity.
  Same for hypotheses — the loop doesn't start below a minimum fact count.
- Dossier size on big projects: token-budget the AI feed (summarize the
  log window, cap per-task output samples) — never truncate mid-JSON.
- Proposals referencing slugs that no longer exist by apply-time (user
  deleted something mid-review): that item fails validation with a clear
  message; others proceed.
- Audit log growth: retention setting (default keep ~90 days of events;
  definition-change events keep forever) with compaction on startup.
- **Retention vs recomputability**: the `facts` table is exempt from that
  compaction by default (facts are tiny; recomputability is an invariant).
  If the user lowers fact retention, compaction first writes per-theorem
  α/β checkpoint facts so the recompute audit still balances.
- Secrets in inputs must not enter the dossier — reuse ticket 98's
  `secret` field flag + masking helper (a hard dependency only for this
  bullet; if 98 hasn't landed, mask nothing but exclude input _values_
  from the dossier entirely, keeping labels/shapes). Facts are immune by
  construction (§3 — hashes only).
- Engine questions decided during grooming, not silently: aggregates
  (`count`/`sum`/`max`) in v1 or v2 (bottleneck hypotheses want them
  early; they complicate stratification), per-evaluation Worker spawn vs
  pooling (measure spawn cost first), and whether the falsifier query runs
  on every evaluation or only at promotion.

## Note

Vocabulary per ticket 96. Depends on 105 for edit-as-new-version
semantics; enriched by 101 (project profile in the dossier) and 98
(summaries make log stats readable) but degrades gracefully without them.
Distinct from ticket 100's "recursive self-improvement" loop: 100 improves
the profile _interview questions_ via selfNotes; this epic improves
_workflows_ via logic-verified theorems — they share no machinery.
Suggested landing order within the epic: §1/§2 → §6/§7 (the page is useful
without RSI) → §3 → §4 → §5 → §8 — the theorem browser and
evidence-backed rationale light up as the later layers land.
