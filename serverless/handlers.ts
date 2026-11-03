import { randomInt } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { LinkStore } from "./store.js";

interface ApiRequest {
  method?: string;
  body?: unknown;
  query: Record<string, string | string[] | undefined>;
  headers: IncomingHttpHeaders;
}

interface ApiResponse {
  status(code: number): this;
  setHeader(name: string, value: string): this;
  json(payload: unknown): this;
  redirect(code: number, destination: string): this;
}

const slugAlphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function generateSlug(): string {
  let slug = "";
  for (let index = 0; index < 6; index += 1) {
    slug += slugAlphabet[randomInt(slugAlphabet.length)];
  }
  return slug;
}

function getSlug(request: ApiRequest): string | undefined {
  const value = request.query.slug;
  return typeof value === "string" && /^[a-zA-Z0-9]{6}$/.test(value) ? value : undefined;
}

function getHeader(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value || null;
  return value?.[0] || null;
}

export async function createLinkHandler(
  request: ApiRequest,
  response: ApiResponse,
  store: LinkStore,
): Promise<ApiResponse> {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const body = request.body;
  const value = typeof body === "object" && body !== null && "url" in body
    ? body.url
    : undefined;
  if (typeof value !== "string") {
    return response.status(400).json({ error: "A URL is required" });
  }

  let destination: URL;
  try {
    destination = new URL(value.trim());
  } catch {
    return response.status(400).json({ error: "Enter a valid HTTP or HTTPS URL" });
  }
  if (!["http:", "https:"].includes(destination.protocol)) {
    return response.status(400).json({ error: "Only HTTP and HTTPS URLs are supported" });
  }

  const publicBaseUrl = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (!publicBaseUrl) {
    return response.status(500).json({ error: "The link service is not configured" });
  }

  try {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const slug = generateSlug();
      if (await store.createLink(slug, destination.toString(), new Date().toISOString())) {
        return response.status(201).json({
          slug,
          shortUrl: `${publicBaseUrl}/r/${slug}`,
        });
      }
    }
    return response.status(503).json({ error: "Could not allocate a unique short link" });
  } catch (error) {
    console.error("Could not create short link", error);
    return response.status(500).json({ error: "Could not create short link" });
  }
}

export async function analyticsHandler(
  request: ApiRequest,
  response: ApiResponse,
  store: LinkStore,
): Promise<ApiResponse> {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const slug = getSlug(request);
  if (!slug) return response.status(404).json({ error: "Short link not found" });

  try {
    const total = await store.getClickCount(slug);
    if (total === null) return response.status(404).json({ error: "Short link not found" });
    return response.status(200).json({ total });
  } catch (error) {
    console.error("Could not load click analytics", error);
    return response.status(500).json({ error: "Could not load click analytics" });
  }
}

export async function redirectHandler(
  request: ApiRequest,
  response: ApiResponse,
  store: LinkStore,
): Promise<ApiResponse> {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const slug = getSlug(request);
  if (!slug) return response.status(404).json({ error: "Short link not found" });

  try {
    const destination = await store.getDestination(slug);
    if (!destination) return response.status(404).json({ error: "Short link not found" });

    await store.recordClick(
      slug,
      new Date().toISOString(),
      getHeader(request.headers["user-agent"]),
      getHeader(request.headers.referer),
    );
    return response.redirect(302, destination);
  } catch (error) {
    console.error("Could not record click event", error);
    return response.status(500).json({ error: "Could not record click event" });
  }
}