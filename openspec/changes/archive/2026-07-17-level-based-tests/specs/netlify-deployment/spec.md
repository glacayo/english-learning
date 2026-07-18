# Delta for Netlify Deployment

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Leaderboard Blob Cleanup On Deploy

The deployment process for this change MUST include a one-time cleanup step
that removes pre-existing leaderboard Blob entries recorded under the old
0-100 scale before the level-aware schema goes live.

#### Scenario: Cleanup runs before level-aware writes begin

- GIVEN the leaderboard Blobs store contains legacy 0-100 scale entries
- WHEN this change's deployment runs
- THEN the cleanup step MUST remove the legacy entries
- AND subsequent submissions MUST use the level-aware schema
