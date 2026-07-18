# Netlify Deployment Specification

## Purpose

Defines the deployment shape of the app: static frontend, serverless API
functions, shared persistence, and the build/test commands Netlify runs.

## Requirements

### Requirement: Static Frontend Hosting

The system MUST deploy the built frontend as a Netlify static site.

#### Scenario: Production build served correctly

- GIVEN a successful `npm run build`
- WHEN the build output is deployed to Netlify
- THEN the site MUST serve the app at the configured Netlify URL

### Requirement: Serverless API

The leaderboard submit/read and name-identity claim (normalized key; retakes
allowed) MUST be implemented as Netlify Functions. Submit MUST validate that
`score` is an **integer** in range 0-10 and `level` is an **integer** in range
1-10, and MUST reject non-integer values as well as out-of-range values. Read
MUST support an optional `?level=N` query filter and default to the global
(all-levels) view when omitted.
(Previously: no level field or filter; score validated 0-100; non-integer
rejection not required.)

#### Scenario: Leaderboard submit endpoint reachable

- GIVEN the site is deployed
- WHEN a client calls the leaderboard submit function endpoint with a valid
  `{name, score, level, attemptId}` payload
- THEN it MUST accept the entry and return a success response

#### Scenario: Leaderboard read endpoint reachable

- GIVEN the site is deployed
- WHEN a client calls the leaderboard read function endpoint with no filter
- THEN it MUST return the current ranked global leaderboard entries

#### Scenario: Leaderboard read endpoint filters by level

- GIVEN the site is deployed with entries across multiple levels
- WHEN a client calls the read endpoint with `?level=5`
- THEN it MUST return only Level 5 entries, ranked

#### Scenario: Out-of-range score or level rejected

- GIVEN the site is deployed
- WHEN a client submits `score: 11` or `level: 0`
- THEN the submit function MUST reject the request with a validation error

#### Scenario: Non-integer score or level rejected

- GIVEN the site is deployed
- WHEN a client submits a non-integer `score` (e.g. `9.5`) or non-integer
  `level` (e.g. `3.2`)
- THEN the submit function MUST reject the request with a validation error

### Requirement: Shared Persistence

The system MUST use Netlify Blobs as the shared store for student names and
leaderboard entries, accessible consistently across function invocations.

#### Scenario: Data persists across function cold starts

- GIVEN a leaderboard entry was written by one function invocation
- WHEN a later, separate function invocation reads the leaderboard
- THEN the previously written entry MUST be present

### Requirement: Build & Test Commands

The repository MUST define a build command and a test command runnable in
Netlify's CI environment.

#### Scenario: CI build produces deployable artifact

- GIVEN the repository is checked out in Netlify CI
- WHEN `npm run build` runs
- THEN it MUST produce a deployable static output directory

#### Scenario: Test command runs the unit suite

- GIVEN the repository is checked out in CI
- WHEN `npm test` runs
- THEN the Vitest suite for scoring, recommendations, and ranking MUST execute and report pass/fail

### Requirement: Leaderboard Blob Cleanup On Deploy

The deployment process for this change MUST include a one-time cleanup step
that removes pre-existing leaderboard Blob entries recorded under the old
0-100 scale before the level-aware schema goes live.

#### Scenario: Cleanup runs before level-aware writes begin

- GIVEN the leaderboard Blobs store contains legacy 0-100 scale entries
- WHEN this change's deployment runs
- THEN the cleanup step MUST remove the legacy entries
- AND subsequent submissions MUST use the level-aware schema

#### Scenario: Destructive cleanup requires explicit target confirmation

- GIVEN an operator runs the cleanup script with `--apply` in explicit mode
- WHEN the `--confirm-site-id` flag is missing or does not match the resolved
  `NETLIFY_SITE_ID`
- THEN the script MUST abort before any deletion with a diagnostic
- AND no destructive action MUST be taken

#### Scenario: Destructive cleanup writes a rollback snapshot before deletion

- GIVEN an operator runs the cleanup script with `--apply` and candidates exist
- WHEN the deletion pass is about to start
- THEN the script MUST write a timestamped JSON rollback snapshot of candidate
  payloads to a file BEFORE any deletion
- AND the snapshot path MUST be reported to the operator

### Requirement: Error Reporting (Resilience)

The serverless API functions SHOULD report internal errors in a structured
format. Reporting MUST be safe by default (never block a response, never
require paid services or new secrets) and MAY optionally report to an
env-configured HTTP endpoint (`ERROR_REPORT_ENDPOINT`) when set.

#### Scenario: Structured error logged on internal failure

- GIVEN a serverless function encounters an internal error (e.g. store failure)
- WHEN the error is caught
- THEN a structured JSON error report MUST be logged to `console.error`
- AND the response MUST NOT be blocked by the reporting

#### Scenario: Optional endpoint reporting when configured

- GIVEN `ERROR_REPORT_ENDPOINT` is set in the function environment
- WHEN an internal error occurs
- THEN the function SHOULD best-effort POST a JSON report to that endpoint
- AND the POST MUST NOT reject or delay the response beyond a bounded timeout

### Note: Progression Is Not Server-Authenticated (Known Non-Security Boundary)

Level progression (unlock/pass state) is intentionally a same-browser,
local-only feature persisted to `localStorage` per claimed-name identity
(level-progression spec "Same-Browser Progression Persistence"). The
serverless API does NOT authorize, verify, or enforce progression integrity.
A student's claimed level or score is accepted by the leaderboard API based on
the integer range validation only, not on whether the student earned the
score through the intended progression path. This is a deliberate v1 design
tradeoff; server-side progression authorization would require a new auth
system not present in the current architecture.
