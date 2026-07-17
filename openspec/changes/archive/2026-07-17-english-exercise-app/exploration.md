# Exploration: english-exercise-app

## Topic
A small web app for children learning English: 100 fixed exercises across 8 grammar/usage topics, name entry, end-of-test auto-grading with mistakes + targeted study recommendations, and a leaderboard ranking by score.

## Project State (verified)

- Working dir: `C:\laragon\www\english-learning`
- No git repo, no source files, no `package.json`, no framework files, no test runner, no Docker, no CI.
- `openspec/` is the only project content:
  - `openspec/config.yaml` declares `schema: spec-driven`, `context: "Tech stack: Not yet established"`, `delivery.execution_mode: interactive`, `pr_strategy: force-chained`, `review_budget_lines: 400`.
  - `openspec/specs/` exists but is empty (no domain folders yet).
  - `openspec/changes/archive/` exists; no active change folders.
- `.atl/skill-registry*` is a SDD skill cache, not project code.
- `openspec/config.yaml` already enforces: first proposal MUST select + justify the stack; `strict_tdd: false` until a test runner is chosen.

This is genuinely greenfield. Any architectural call (frontend stack, persistence, test runner) is open.

## Requirements (extracted from the user request)

Functional MUST-haves:

1. **Exercise bank**: 100 exercises, distributed across 8 topics:
   - Present simple (affirmative/negative/question forms)
   - Simple past
   - Present progressive
   - Simple past, third person (singular subject verb agreement in past)
   - Present simple, third person (singular subject verb agreement in present)
   - Present progressive, third person
   - Daily routine vocabulary / sentence frames
   - Like / don't like (preference + gerund)
2. **Name entry**: a child types their name and starts the test.
3. **End-of-test auto-evaluation**: score, list of mistakes, recommendation of what to study to improve (derived from wrong topics).
4. **Leaderboard / positions table**: ranked by score, shared across children.

Non-functional / product:

- Audience: children. UX must be child-friendly (large hit areas, simple language, forgiving input, no hostile error states).
- Single-machine first run, no obvious user accounts beyond a name string. Identity model needs a decision (see Risks).
- Greenfield stack — framework, persistence, test runner, build, and deploy target all undecided.

## Affected Areas

Because nothing exists yet, "affected areas" are forward-looking — the files/folders this change will introduce:

- `package.json` + lockfile — manifests for run/test/build.
- `src/` (or framework equivalent) — app code.
  - `src/content/exercises.ts` (or `.json`) — the 100 exercise records, single source of truth.
  - `src/scoring/` — pure functions: `gradeAnswer`, `summarize`, `recommendTopics`.
  - `src/leaderboard/` — persistence + ranking logic.
  - `src/ui/` or `app/routes/*` — screens: name entry, exercise runner, results, leaderboard.
- `tests/` — unit tests for scoring + recommendation logic (the parts that have to be correct).
- `openspec/changes/english-exercise-app/{proposal,specs,design,tasks}.md` — this change's SDD artifacts.
- `openspec/specs/{exercises,scoring,leaderboard,ux}/spec.md` — durable main specs to be merged on archive.

## Approaches

Three real forks. I scored them on the dimensions the user actually cares about for this app.

### A. Static SPA + browser storage (localStorage). No backend.

- **Stack**: e.g. Vite + React + TypeScript, plain CSS or Tailwind. Pure client app. Optional Vitest for unit tests.
- **Persistence**: `localStorage` (or `IndexedDB` if 100 exercises + history gets large — for a 100-item bank it is not). Leaderboard = array of `{name, score, timestamp, topicStats}` stored locally.
- **Pros**
  - Cheapest to ship: zero infra, single static deploy (or even `file://`).
  - Aligns with the 400-line review budget — the first PR can be "stack + scoring + tests" and a second PR can add the UI shell.
  - Scoring and recommendation logic are pure functions, easy to TDD once Vitest is in.
  - Child-friendly UX (large buttons, animations) is straightforward in React.
  - Greenfield-friendly: Vite scaffolds in seconds, no backend to provision.
- **Cons**
  - Leaderboard is **per device/browser**. A child at school does not see the leaderboard from home. This is a real product regression vs. the user's "students can see a leaderboard" intent if it is meant to be shared.
  - Names collide and are not unique. No abuse protection (a child can type `asdf` 100 times and top the board).
  - No server-side time/clock, so ties need deterministic tie-breaks.
- **Effort**: Low.

### B. SPA + tiny hosted backend (e.g. Postgres on Supabase or SQLite on a single Node/Hono service).

- **Stack**: same frontend as A, plus a small typed API. Postgres for the leaderboard (with simple RLS or a single shared table keyed by name + attempt id); or SQLite + a single-file backend for self-hosting.
- **Pros**
  - Real cross-device leaderboard, the user's intent.
  - Postgres gives a stable place to keep the 100 exercises too (single source of truth, versioned, editable without redeploying the SPA).
  - Supabase ships with auth + RLS if we ever want teacher / child accounts later.
- **Cons**
  - More moving parts: auth (or anonymous-but-rate-limited submission), schema, migrations, env vars, deploy of two services.
  - Easily blows the 400-line review budget if done in one PR → must use the project's `force-chained` strategy and split: stack skeleton, content model, scoring, UI, leaderboard backend, deploy.
  - Strict TDD can come back online cleanly here (Vitest + a real test DB or a Postgres test container).
- **Effort**: Medium–High.

### C. Server-rendered app (Next.js / SvelteKit) with file/SQLite persistence and SSR leaderboard.

- **Pros**
  - Single deploy, SSR leaderboard, no CORS dance, easy to seed `exercises.json` from the repo.
  - Good for SEO-free classroom hosting (e.g. LAN).
- **Cons**
  - Heavier than A for the same UX, no real win over B for this scope.
  - Forces a specific framework before the user has expressed one; the user did not ask for SSR.
- **Effort**: Medium.

## Recommendation

**Start with Approach A (Vite + React + TypeScript + Vitest, `localStorage` leaderboard) and design the data layer so the leaderboard can be lifted to a backend later without rewriting the UI.**

Why this fits the user request and the project state:

- "Small app" + no infrastructure hints in the prompt = ship the smallest thing that meets the requirements.
- The 100-exercise bank, the scoring rules, and the topic-recommendation logic are the **interesting** parts and are pure functions — they live in the frontend either way and are easy to TDD with Vitest. Even if we later move to B, those pure modules do not change.
- A leaderboard scoped to one device/browser is a defensible v1 for a *children's learning app used in a single classroom* (teacher's laptop, shared screen), which is the most realistic deployment implied by "small app". The proposal MUST make this scope explicit and offer B as the explicit next step.
- It respects `openspec/config.yaml`: first proposal selects + justifies the stack, and the 400-line review budget is naturally satisfied by chaining (stack+content+scoring → UI → polish).

If during the proposal the user confirms they want a shared, cross-device leaderboard, the recommendation flips to B (Vite + React + Hono/Node + SQLite, or React + Supabase). I do not want to lock that in during exploration without their input.

## Risks

- **R1 — Leaderboard scope ambiguity (highest).** "Students can see a leaderboard" almost certainly means cross-device in a classroom. `localStorage` violates that intent if kids switch devices. Proposal must surface the question explicitly with a default.
- **R2 — No identity model.** Names are free text → collisions (`"Maria"`), griefing, and no "this is the same kid" signal across attempts. v1 should at minimum dedupe case-insensitively, store an attempt id, and rate-limit writes per name per minute. v2 should add a teacher-set nickname or a 4-digit PIN.
- **R3 — Content authoring.** 100 hand-authored exercises across 8 topics is non-trivial and error-prone (typos in correct answers invalidate grading). The bank MUST be a single checked-in file, versioned, with a small CI lint (unique id, non-empty `correctAnswer`, every topic ≥ N items, sum == 100). Otherwise we discover drift mid-class.
- **R4 — Topic distribution.** "100 exercises across 8 topics" leaves distribution open. Recommend an explicit, balanced default in the proposal (e.g. ~12–13 per topic, with daily-routine and like/don't-like getting extra weight because they're vocabulary-light and easier for children) and a `topic` field on every record so the recommendation engine works.
- **R5 — Scoring fairness.** Should partial credit exist (e.g. capitalization tolerance, accepted synonyms like "I'm" / "I am")? The recommendation engine's quality depends on this. Proposal must commit to a single grading policy (suggest: case-insensitive equality + a small per-exercise `acceptedAnswers[]` list) and TDD it.
- **R6 — Recommendation quality.** "What to study" is the most product-defining output. It must be a *pure* function of the attempt's per-topic miss rate (`recommendTopics(perTopicStats) → TopicRecommendation[]`), and the formula should be decided in the proposal (suggest: topics with miss rate ≥ 40% surface first, in descending order, with at most 3 recommendations per attempt).
- **R7 — Stack lock-in for the 400-line budget.** Vite + React + TS is a fine default but is still a choice. If the user wants Svelte/Solid/Vanilla/Next, every chain PR shifts. Resolve in the proposal before sdd-tasks forecasts line counts.
- **R8 — No test runner yet.** `strict_tdd: false` per config. Recommendation: enable Vitest from PR #1 and TDD the scoring + recommendation + leaderboard-sort modules only. UI stays manual/visual until we have a runner the team trusts.
- **R9 — Greenfield deploy target unknown.** "Small app for children" hints at a classroom setting. Local-first (`npm run dev` on the teacher's laptop, kids hit it on the same Wi-Fi) is the cheapest path. Proposal should pick one deploy story so the design phase doesn't have to.

## Open Questions for the User (must be resolved before sdd-propose)

I need exactly one of these answered per turn; I'll start with the highest-leverage one.

1. **Leaderboard scope — local-only on one device, or shared across devices?** (drives A vs. B)
2. **Stack preference** — Vite + React + TypeScript is my default; OK, or do you want a specific framework?
3. **Topic distribution** — should I split 100 evenly (~12–13 per topic) or weight the simpler topics higher for children?
4. **Grading strictness** — strict case-sensitive equality, or lenient (case-insensitive + accepted synonyms per item)?
5. **Deploy target** — classroom laptop on local Wi-Fi, public static site, or hosted backend?

## Ready for Proposal

**Partially.** Exploration is complete and the recommendation is clear, but question #1 (leaderboard scope) materially changes the stack. The orchestrator should ask the user the leaderboard question first, then launch `sdd-propose` with the answer (and ideally question #2 alongside it). Once those are answered, `sdd-propose` can write the stack-justification proposal this project's `config.yaml` already requires.

## Artifacts

- `openspec/changes/english-exercise-app/exploration.md` (this file)
