# TinyURL Engine

Link shortener with a React dashboard, HTTP 302 redirects, and per-link click analytics stored in SQLite.

## Requirements

- Node.js 24 or newer
- npm

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open the Vite dashboard at `http://localhost:5173`. The API and native redirects run on `http://localhost:3000`. `PUBLIC_BASE_URL` controls the host returned in `shortUrl`; `DATABASE_PATH` selects the SQLite file.

For a production build, run `npm run build` followed by `npm start`. Fastify serves the built interface and API from the same origin.

## Deploy on Vercel

The Vercel deployment serves the Vite interface and runs the API routes in `api/` as serverless functions. The API uses SQLite at `/tmp/tinyurl.sqlite` on Vercel, so no external database connection string is required. Set `PUBLIC_BASE_URL` in the Vercel project to the public app URL, such as `https://encurtador-link-web.vercel.app`.

Vercel's `/tmp` storage is temporary and isolated per function instance. This setup is suitable for a study/demo deployment, but links and analytics can disappear after an instance is recycled or be unavailable across instances. Local development continues to use SQLite via `DATABASE_PATH`.

## API

Create a short link with `POST /api/links`:

```json
{"url":"https://example.com/a-long-page"}
```

Successful requests return HTTP 201 with a six-character slug and its short URL. Destinations must be absolute HTTP or HTTPS URLs.

`GET /r/{slug}` records an asynchronous SQLite click event containing a UTC timestamp, user-agent, and referrer, then returns HTTP 302 with the destination in `Location`. The insert completes before the redirect is sent. Missing request headers are stored as null; if persistence fails, the redirect is not sent. Unknown slugs return HTTP 404.

`GET /api/links/{slug}/analytics` returns HTTP 200 with `{ "total": 0 }` or the number of persisted click events. Unknown slugs return HTTP 404.

## Dashboard

Created slugs are retained in the current browser's `localStorage` and displayed with the short URL, destination host, creation time, and click count. Analytics refresh every five seconds while the page is open. The app does not expose an unauthenticated global links listing. Click metadata is retained indefinitely in SQLite and is not copied into application logs.

## Checks

```bash
npm test
npm run typecheck
npm run build
```