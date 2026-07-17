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
allowed) MUST be implemented as Netlify Functions.

#### Scenario: Leaderboard submit endpoint reachable

- GIVEN the site is deployed
- WHEN a client calls the leaderboard submit function endpoint
- THEN it MUST accept a score entry and return a success response

#### Scenario: Leaderboard read endpoint reachable

- GIVEN the site is deployed
- WHEN a client calls the leaderboard read function endpoint
- THEN it MUST return the current ranked leaderboard entries

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
