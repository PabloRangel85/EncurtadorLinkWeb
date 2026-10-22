# Spec Delta

## Purpose

Provides short-link creation, fast HTTP redirects, and per-link click totals backed by durable SQLite records.

## ADDED Requirements

### Requirement: Create a short link
The system SHALL accept an absolute HTTP or HTTPS URL and create a short link whose slug contains exactly six URL-safe characters. The slug SHALL be unique among stored links. On success, the system SHALL return HTTP 201 with the slug and short URL. Invalid URLs SHALL be rejected with HTTP 400.

#### Scenario: Create a link successfully
- **WHEN** a client submits a valid absolute HTTP or HTTPS URL to `POST /api/links`
- **THEN** the system returns HTTP 201 with a unique six-character slug and its short URL

#### Scenario: Reject an unsupported or malformed URL
- **WHEN** a client submits a malformed URL or a URL using a scheme other than HTTP or HTTPS
- **THEN** the system returns HTTP 400 and does not create a link

#### Scenario: Resolve a slug collision
- **WHEN** slug generation produces a slug that is already stored
- **THEN** the system generates another slug and does not overwrite the existing link

### Requirement: Redirect and record click events
The system SHALL resolve `GET /r/{slug}` to the original URL and return HTTP 302. It SHALL persist one click event using asynchronous SQLite I/O before returning the redirect. The event SHALL contain a UTC timestamp, the request user-agent, and the request referrer. Missing user-agent or referrer values SHALL be stored as null. An unknown slug SHALL return HTTP 404.

#### Scenario: Redirect a known short link
- **WHEN** a client requests `GET /r/{slug}` for a stored slug
- **THEN** the system persists the click event and returns HTTP 302 with the original URL in the `Location` header

#### Scenario: Record a click with missing request metadata
- **WHEN** a client requests a known slug without a user-agent or referrer header
- **THEN** the system records the event with null for each missing value and returns HTTP 302

#### Scenario: Request an unknown short link
- **WHEN** a client requests `GET /r/{slug}` for a slug that does not exist
- **THEN** the system returns HTTP 404 and does not create a click event

### Requirement: Query total clicks
The system SHALL expose the total number of recorded click events for a link at `GET /api/links/{slug}/analytics`. A successful response SHALL return HTTP 200 with the total as a non-negative integer. An unknown slug SHALL return HTTP 404.

#### Scenario: Query analytics for a known link
- **WHEN** a client requests analytics for a stored slug
- **THEN** the system returns HTTP 200 with the total number of persisted click events for that slug

#### Scenario: Query analytics for a link with no clicks
- **WHEN** a client requests analytics for a stored slug with no click events
- **THEN** the system returns HTTP 200 with a total of zero

#### Scenario: Query analytics for an unknown link
- **WHEN** a client requests analytics for a slug that does not exist
- **THEN** the system returns HTTP 404

### Requirement: Manage created links in the web interface
The web interface SHALL provide a URL input and an "Encurtar" action, display the created short URL with a copy action, and show created links in a table with their click totals. It SHALL retain the current browser's created-link list across reloads and refresh visible click totals periodically without a full-page reload.

#### Scenario: Create and copy a short link
- **WHEN** a user submits a valid URL and activates the copy action
- **THEN** the interface displays the returned short URL, copies it to the clipboard, and adds the link to the table

#### Scenario: Retain created links after reload
- **WHEN** a user reloads the interface after creating links in that browser
- **THEN** the created links remain in the table and their click totals are fetched again

#### Scenario: Refresh click totals
- **WHEN** the interface remains open with created links in the table
- **THEN** it periodically requests analytics and updates the displayed totals without a full-page reload

#### Scenario: Report link creation errors
- **WHEN** link creation fails because the URL is invalid or the service is unavailable
- **THEN** the interface presents an error and does not add a failed link to the table