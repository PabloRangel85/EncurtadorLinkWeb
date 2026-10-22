# Design

## Context

There is no application code or database configuration in the workspace. The selected stack is Node.js + TypeScript, Fastify, React/Vite, and SQLite through an asynchronous driver. The contract is defined in `specs/tinyurl-analytics/spec.md`.

## Goals / Non-Goals

**Goals:**
- Keep redirect work to an indexed slug lookup and one click-event insert.
- Use asynchronous SQLite I/O and persist click metadata before sending the redirect response.
- Make slug uniqueness robust under concurrent link creation.
- Let users create, copy, and monitor links from one responsive interface.

**Non-Goals:**
- User accounts, custom aliases, link expiration, dashboards, or click breakdowns.
- Fetching or inspecting destination URLs on the server.
- Authentication, shared link administration, or a global links listing.

## Decisions

- Store links in a `links` table with a six-character slug as the primary key, the original URL, and a creation timestamp. Store click events in a separate `click_events` table with an event id, slug foreign key, UTC timestamp, user-agent, and referrer. Index click events by slug so analytics can count a link's events without scanning unrelated links.
- Generate six-character URL-safe slugs using a cryptographically secure random source. Enforce uniqueness in SQLite and retry after a uniqueness conflict; application-side pre-checks alone are insufficient under concurrent requests.
- Use Fastify for API and `/r/:slug` routing, React/Vite for the interface, and the promise-based `sqlite` API with the `sqlite3` driver for asynchronous local SQLite access. Fastify serves the built frontend from the same origin; Vite proxies API and redirect requests during development.
- Read `PUBLIC_BASE_URL` from configuration when constructing `shortUrl`; do not infer the public origin from an untrusted request header.
- Retain click events indefinitely in the initial version, as requested. Do not store user-agent or referrer values in application logs.
- Resolve the destination, await the asynchronous click-event insert, then return HTTP 302 with the destination in `Location`. A 302 avoids permanent redirect caching that could bypass per-request analytics. If persistence fails, do not return a successful redirect with missing analytics.
- Validate submitted destinations as absolute HTTP or HTTPS URLs. The service redirects clients but does not fetch destinations, so this avoids unsafe schemes without introducing server-side URL-fetch behavior.
- `POST /api/links` returns `201` and JSON containing `slug` and `shortUrl`; analytics returns `200` and JSON containing `total`.
- Store created slugs in browser `localStorage`, rather than exposing an unauthenticated global links endpoint. Poll analytics for visible links every five seconds and update the table in place.

Alternatives considered: sequential or timestamp-derived slugs are easier to generate but expose creation order and are less suitable as opaque public identifiers. A single table with click counters makes writes cheap but loses event-level metadata and does not meet the requested event collection. Fire-and-forget click writes reduce redirect latency but can lose events if the process stops before flushing, so the asynchronous insert is awaited before responding.

## Risks / Trade-offs

- Awaited event persistence adds database latency to redirects → use asynchronous I/O, keep the lookup and insert indexed and minimal, enable SQLite WAL mode, and measure latency.
- Random slug collisions become more likely as the namespace fills → rely on the database uniqueness constraint and bounded retry handling; select the alphabet and exhaustion behavior during implementation.
- User-agent and referrer values may contain identifying or sensitive data, and indefinite retention increases exposure → store only the requested fields, avoid logging their raw values elsewhere, and document that deleting the database deletes all analytics.
- SQLite write concurrency is limited compared with a server database → use a single local database and appropriate busy handling for the initial service; reassess only if measured write contention requires it.

## Migration Plan

Create the SQLite schema on service startup using an idempotent migration or schema initialization step. No existing application data or deployed API is present in this workspace, so no backfill or compatibility migration is required. Rollback consists of stopping the service and removing the newly created database only when its data is intentionally disposable. The browser-side created-link list can be cleared independently from server-side links and analytics.
