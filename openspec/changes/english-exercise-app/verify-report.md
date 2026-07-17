# Verification Report: English Exercise App — Deployed Netlify Smoke

**Change**: `english-exercise-app`  
**Artifact mode**: OpenSpec  
**Mode**: Standard verification (`strict_tdd: false`)  
**Date**: 2026-07-17  
**Deployed URL**: <https://en-learn.netlify.app/>  
**Scope**: Final task `5.3` deploy-preview/site smoke verification plus deterministic repo commands.  
**Constraint honored**: No local dev/preview/server command was started. Browser checks targeted only the deployed Netlify URL.

## Verdict

**PASS WITH WARNINGS** — deployed smoke passed for page load, name entry, exercise completion to results, results content, Netlify Function submission, leaderboard loading, submitted-attempt visibility, and retake navigation. Deterministic repo commands also passed.

One non-blocking warning remains: a direct deployed normalized-name retake check accepted a case/whitespace variant but returned that trimmed variant casing instead of preserving the first claimed display casing. This does not break the smoke path, uniqueness key, submit, leaderboard, or retake flow observed here, but it is a design-coherence warning worth revisiting before relying on canonical display casing.

## Completeness Table

| Metric | Value |
|--------|-------|
| Tasks total | 18 |
| Tasks complete after this run | 18 |
| Tasks incomplete | 0 |
| Deterministic required commands | 3/3 passed |
| Deployed smoke required behaviors | 7/7 passed with 1 warning |
| Local servers started | 0 |

## Build & Tests Execution

Commands were run from `C:\laragon\www\english-learning`.

| Command | Exit Code | Result | Evidence |
|---------|-----------|--------|----------|
| `npm run typecheck` | 0 | PASS | `tsc -b` completed with no reported errors. |
| `npm test` | 0 | PASS | Vitest v4.1.10: `13 passed (13)` test files, `138 passed (138)` tests, duration 2.94s. |
| `npm run build` | 0 | PASS | `tsc -b && vite build`; Vite v7.3.6 transformed 41 modules and built `dist/index.html`, CSS, and JS. |

**Coverage**: Not configured (`openspec/config.yaml` coverage threshold: `0`, coverage command empty).

## Deployed Smoke Evidence

| Required behavior | Result | Evidence |
|-------------------|--------|----------|
| Page loads from deployed URL | PASS | Browser loaded `https://en-learn.netlify.app/`; document and static assets returned 200. |
| Student can enter unique test name and start | PASS | Entered `Smoke-20260717-1410`; `POST /.netlify/functions/claim-name` returned 200 with `{"ok":true,"name":"Smoke-20260717-1410"}`. |
| Exercise flow reaches results | PASS | Used safe browser automation against deployed UI buttons: clicked `Skip` through 99 questions, then `Finish` on question 100. This intentionally produced a complete 0-score attempt without bypassing app screens or local state. |
| Results show score/mistakes/recommendations | PASS | Results rendered `0 out of 100`, `Mistakes (100)`, and study tips including `Daily Routine`, `Like / Don't Like`, and `Present Progressive`. |
| Submit reaches Netlify Functions and not 404 | PASS | `POST /.netlify/functions/submit-score` returned 200, body `{"ok":true}`. Submitted payload included attemptId `930a0e03-7d2b-4410-b142-4ef73bff3726`. |
| Leaderboard loads and includes submitted attempt | PASS | `GET /.netlify/functions/get-leaderboard` returned 200 and included `{attemptId:"930a0e03-7d2b-4410-b142-4ef73bff3726", name:"Smoke-20260717-1410", score:0}`; UI displayed rank `1`, name, and score `0`. |
| Retake/canonical/leaderboard behavior not obviously broken | PASS WITH WARNING | `Back` from leaderboard returned to results; `Try again` opened `Question 1 of 100` for a retake. Direct normalized-name claim with `"  smoke-20260717-1410  "` returned 200 `{ok:true,name:"smoke-20260717-1410"}`; accepted as same normalized identity but did not preserve first display casing. |

Additional browser evidence:

- Console messages: none observed.
- Network statuses: `GET /` 200, JS asset 200, CSS asset 200, `claim-name` 200, `submit-score` 200, `get-leaderboard` 200.

## Spec Compliance Matrix

| Capability | Deployment-relevant scenario | Runtime evidence | Result |
|------------|------------------------------|------------------|--------|
| `student-session` | Valid name starts a session | Deployed name form accepted `Smoke-20260717-1410`; claim function 200; exercise runner opened. | COMPLIANT |
| `student-session` | Case/whitespace collapse to same identity and retake allowed | Deployed claim with whitespace/lowercase variant returned 200 OK; retake UI opened a fresh attempt. | COMPLIANT WITH WARNING |
| `student-session` | Retakes start another attempt | Results → `Try again` displayed `Question 1 of 100`. | COMPLIANT |
| `scoring-feedback` | Results screen shows score, mistakes, recommendations | Deployed results rendered score, 100 mistakes, accepted answers, and study tips. | COMPLIANT |
| `shared-leaderboard` | Successful submission | Deployed `submit-score` function returned 200 `{ok:true}` for the completed attempt. | COMPLIANT |
| `shared-leaderboard` | Cross-device/server read path | Deployed `get-leaderboard` function returned persisted submitted attempt after a separate read call. | COMPLIANT |
| `netlify-deployment` | Production frontend served correctly | Deployed URL and static assets returned 200 and rendered the React app. | COMPLIANT |
| `netlify-deployment` | Serverless API reachable | `claim-name`, `submit-score`, and `get-leaderboard` all returned 200; no 404s. | COMPLIANT |
| `netlify-deployment` | Build and test commands | `npm run typecheck`, `npm test`, and `npm run build` passed locally without server startup. | COMPLIANT |

## Correctness Table

| Area | Status | Notes |
|------|--------|-------|
| Exercise flow | PASS | Deployed UI moved from name entry through 100-question completion to results. |
| Results content | PASS | Score, mistakes, accepted answers, and recommendations displayed. |
| Netlify Functions | PASS | Required deployed endpoints returned 200 and valid JSON. |
| Shared leaderboard | PASS | Submitted attempt appeared in deployed leaderboard response and UI. |
| Retake | PASS | `Try again` reopened the exercise runner. |
| Canonical display casing | WARNING | Normalized variant was accepted, but direct API response did not preserve first claimed display casing. |

## Design Coherence Table

| Design Decision | Followed? | Evidence |
|-----------------|-----------|----------|
| Vite + React + TypeScript SPA deployed as static site | Yes | Deployed page/assets loaded; `npm run build` passed. |
| Client-side grading against bundled catalog | Yes | Deployed completion generated local score/mistakes/recommendations before/alongside submit. |
| Netlify Functions + Blobs behind API boundary | Yes | Deployed function endpoints handled claim, submit, and leaderboard read. |
| Name identity + retakes | Mostly | Retake path works; normalized case/whitespace claim accepted, but canonical display casing behavior has a warning. |
| One leaderboard row per attempt | Yes for smoke attempt | Submitted attempt appeared as its own row with attemptId in deployed leaderboard response. |

## Issues Found

### CRITICAL

None.

### WARNING

- Direct deployed `claim-name` retake/canonical probe with a case/whitespace variant returned the variant casing (`smoke-20260717-1410`) instead of the first claimed display casing (`Smoke-20260717-1410`). Smoke behavior still passed, but this is a design-coherence warning for canonical display-name convergence.

### SUGGESTION

- Add a deployed or integration-level assertion for canonical display casing if preserving the first claimed casing is required, because unit tests alone did not expose the deployed behavior observed here.

## Final Verdict

**PASS WITH WARNINGS** — task `5.3` deployed smoke is complete. The site works on Netlify for the required user journey and serverless leaderboard path; only the non-blocking canonical display-casing warning remains.
