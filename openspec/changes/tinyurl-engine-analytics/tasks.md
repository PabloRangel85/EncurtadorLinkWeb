# Tasks

## 1. Backend Foundation

- [x] 1.1 Scaffold a Node.js + TypeScript app with Fastify, React/Vite, the `sqlite` promise API, `sqlite3`, and a test runner; verify dependency installation, typecheck, and frontend build succeed.
- [x] 1.2 Add configuration for `PUBLIC_BASE_URL` and SQLite database location, plus an example environment file; verify startup rejects missing or malformed required configuration.
- [x] 1.3 Initialize the SQLite schema idempotently with foreign keys, WAL mode, a unique slug key, and a click-event slug index using asynchronous database calls; verify a fresh database starts and repeated initialization preserves existing data.

## 2. Short-Link Creation

- [x] 2.1 Implement absolute HTTP/HTTPS URL validation and six-character cryptographically random slug generation with database-enforced uniqueness and collision retry; verify malformed and unsupported URLs return HTTP 400 and collisions never overwrite existing links.
- [x] 2.2 Implement `POST /api/links` to persist valid destinations and return HTTP 201 with `slug` and `shortUrl` based on `PUBLIC_BASE_URL`; verify route tests cover success, invalid input, and the response shape.
- [x] 2.3 Document the create-link request and response contract; verify the documented example matches the route tests.

## 3. Redirect and Click Events

- [x] 3.1 Implement indexed slug lookup and `GET /r/{slug}` with HTTP 302, awaiting asynchronous persistence of a UTC click event before sending the response; verify an integration test checks status, `Location`, and a stored event.
- [x] 3.2 Capture user-agent and referrer values, storing missing headers as null, and return HTTP 404 for unknown slugs; verify tests cover absent headers and unknown slugs without creating events.
- [x] 3.3 Document click-event fields and indefinite retention; verify the documentation states user-agent/referrer are stored and not copied into application logs.

## 4. Click Analytics

- [x] 4.1 Implement `GET /api/links/{slug}/analytics` to return HTTP 200 with the persisted event count; verify tests cover zero clicks and multiple clicks.
- [x] 4.2 Return HTTP 404 for analytics requests on unknown slugs and add API-level regression tests; verify the complete test suite passes.
- [x] 4.3 Document analytics response and error behavior; verify the documented statuses and JSON fields match the tests.

## 5. Web Interface

- [x] 5.1 Build a responsive React interface with URL input, "Encurtar" action, generated-link display, and clipboard copy; verify browser tests cover successful creation, copy, loading, and error states.
- [x] 5.2 Persist created slugs in browser `localStorage` and render them in a links table; verify links return after reload without adding a global unauthenticated listing API.
- [x] 5.3 Poll analytics for visible links every five seconds and update table totals in place; verify browser tests observe updated counts without a full-page reload.
- [x] 5.4 Serve the production frontend from Fastify and configure the Vite development proxy; verify production build and local development use the same API and `/r/:slug` routes.

## 6. Integration and Documentation

- [x] 6.1 Document frontend, API, redirect, async metric persistence, and environment configuration; verify examples match implemented response shapes.
- [x] 6.2 Run the complete unit, integration, typecheck, and frontend build checks; verify link creation through the UI, a native HTTP 302, and refreshed click totals end to end.