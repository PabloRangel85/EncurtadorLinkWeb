import { access } from "node:fs/promises";
import { randomInt } from "node:crypto";
import { join } from "node:path";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import type { AppConfig } from "./config.js";
import type { AppDatabase } from "./database.js";

const slugAlphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generateSlug(): string {
  let slug = "";
  for (let index = 0; index < 6; index += 1) {
    slug += slugAlphabet[randomInt(slugAlphabet.length)];
  }
  return slug;
}

interface AppOptions {
  config: AppConfig;
  database: AppDatabase;
  staticDir?: string;
  slugGenerator?: () => string;
}

interface CreateLinkBody {
  url?: unknown;
}

export async function createApp({
  config,
  database,
  staticDir,
  slugGenerator = generateSlug,
}: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });

  app.get("/health", async () => ({ status: "ok" }));

  app.post<{ Body: CreateLinkBody }>("/api/links", async (request, reply) => {
    const value = request.body?.url;
    if (typeof value !== "string") {
      return reply.code(400).send({ error: "A URL is required" });
    }

    let destination: URL;
    try {
      destination = new URL(value.trim());
    } catch {
      return reply.code(400).send({ error: "Enter a valid HTTP or HTTPS URL" });
    }

    if (!["http:", "https:"].includes(destination.protocol)) {
      return reply.code(400).send({ error: "Only HTTP and HTTPS URLs are supported" });
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const slug = slugGenerator();
      try {
        await database.run(
          "INSERT INTO links (slug, original_url, created_at) VALUES (?, ?, ?)",
          slug,
          destination.toString(),
          new Date().toISOString(),
        );

        return reply.code(201).send({
          slug,
          shortUrl: `${config.publicBaseUrl}/r/${slug}`,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          typeof error.code === "string" &&
          error.code.startsWith("SQLITE_CONSTRAINT")
        ) {
          continue;
        }
        request.log.error({ err: error }, "Could not create short link");
        return reply.code(500).send({ error: "Could not create short link" });
      }
    }

    return reply.code(503).send({ error: "Could not allocate a unique short link" });
  });

  app.get<{ Params: { slug: string } }>("/r/:slug", async (request, reply) => {
    const link = await database.get<{ original_url: string }>(
      "SELECT original_url FROM links WHERE slug = ?",
      request.params.slug,
    );

    if (!link) {
      return reply.code(404).send({ error: "Short link not found" });
    }

    try {
      await database.run(
        "INSERT INTO click_events (slug, clicked_at, user_agent, referrer) VALUES (?, ?, ?, ?)",
        request.params.slug,
        new Date().toISOString(),
        request.headers["user-agent"] || null,
        request.headers.referer || null,
      );
    } catch (error) {
      request.log.error({ err: error }, "Could not record click event");
      return reply.code(500).send({ error: "Could not record click event" });
    }

    return reply.redirect(link.original_url, 302);
  });

  app.get<{ Params: { slug: string } }>(
    "/api/links/:slug/analytics",
    async (request, reply) => {
      const link = await database.get<{ slug: string }>(
        "SELECT slug FROM links WHERE slug = ?",
        request.params.slug,
      );

      if (!link) {
        return reply.code(404).send({ error: "Short link not found" });
      }

      const result = await database.get<{ total: number }>(
        "SELECT COUNT(*) AS total FROM click_events WHERE slug = ?",
        request.params.slug,
      );

      return { total: result?.total ?? 0 };
    },
  );

  if (staticDir) {
    try {
      await access(join(staticDir, "index.html"));
      await app.register(fastifyStatic, { root: staticDir });
      app.setNotFoundHandler((request, reply) => {
        if (request.method === "GET" && !request.url.startsWith("/api/") && !request.url.startsWith("/r/")) {
          return reply.sendFile("index.html");
        }
        return reply.code(404).send({ error: "Not found" });
      });
    } catch {
      app.log.warn({ staticDir }, "Built frontend not found; serving API only");
    }
  }

  return app;
}