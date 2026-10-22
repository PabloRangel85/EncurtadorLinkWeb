import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "./app.js";
import { createDatabase, type AppDatabase } from "./database.js";

describe("short-link API", () => {
  let app: FastifyInstance;
  let database: AppDatabase;
  let slugSequence: string[];

  beforeEach(async () => {
    slugSequence = ["abc123", "abc123", "def456"];
    database = await createDatabase(":memory:");
    app = await createApp({
      config: {
        publicBaseUrl: "https://short.test",
        databasePath: ":memory:",
        port: 3000,
      },
      database,
      slugGenerator: () => slugSequence.shift() ?? "zzzzzz",
    });
  });

  afterEach(async () => {
    await app.close();
    await database.close();
  });

  it("creates six-character links and retries slug collisions", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/api/links",
      payload: { url: "https://example.com/path" },
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/links",
      payload: { url: "https://example.org/" },
    });

    expect(first.statusCode).toBe(201);
    expect(first.json()).toEqual({
      slug: "abc123",
      shortUrl: "https://short.test/r/abc123",
    });
    expect(second.statusCode).toBe(201);
    expect(second.json().slug).toBe("def456");
  });

  it.each(["not a url", "javascript:alert(1)", "ftp://example.com/file"])(
    "rejects invalid destination %s",
    async (url) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/links",
        payload: { url },
      });

      expect(response.statusCode).toBe(400);
      expect(await database.get("SELECT slug FROM links")).toBeUndefined();
    },
  );

  it("records request metadata before returning a native HTTP 302", async () => {
    await app.inject({
      method: "POST",
      url: "/api/links",
      payload: { url: "https://example.com/landing" },
    });

    const redirect = await app.inject({
      method: "GET",
      url: "/r/abc123",
      headers: {
        "user-agent": "Analytics Test Agent",
        referer: "https://source.test/campaign",
      },
    });
    const event = await database.get<{
      clicked_at: string;
      user_agent: string;
      referrer: string;
    }>("SELECT clicked_at, user_agent, referrer FROM click_events WHERE slug = ?", "abc123");

    expect(redirect.statusCode).toBe(302);
    expect(redirect.headers.location).toBe("https://example.com/landing");
    expect(event?.user_agent).toBe("Analytics Test Agent");
    expect(event?.referrer).toBe("https://source.test/campaign");
    expect(Number.isNaN(Date.parse(event?.clicked_at ?? ""))).toBe(false);
  });

  it("counts clicks and handles missing metadata and unknown slugs", async () => {
    await app.inject({
      method: "POST",
      url: "/api/links",
      payload: { url: "https://example.com/" },
    });
    const emptyAnalytics = await app.inject({ method: "GET", url: "/api/links/abc123/analytics" });
    await app.inject({ method: "GET", url: "/r/abc123", headers: { "user-agent": "" } });
    await app.inject({ method: "GET", url: "/r/abc123", headers: { "user-agent": "" } });

    const analytics = await app.inject({ method: "GET", url: "/api/links/abc123/analytics" });
    const event = await database.get<{ user_agent: string | null; referrer: string | null }>(
      "SELECT user_agent, referrer FROM click_events WHERE slug = ? LIMIT 1",
      "abc123",
    );
    const missingRedirect = await app.inject({ method: "GET", url: "/r/missing" });
    const missingAnalytics = await app.inject({ method: "GET", url: "/api/links/missing/analytics" });

    expect(emptyAnalytics.json()).toEqual({ total: 0 });
    expect(analytics.statusCode).toBe(200);
    expect(analytics.json()).toEqual({ total: 2 });
    expect(event).toEqual({ user_agent: null, referrer: null });
    expect(missingRedirect.statusCode).toBe(404);
    expect(missingAnalytics.statusCode).toBe(404);
  });
});