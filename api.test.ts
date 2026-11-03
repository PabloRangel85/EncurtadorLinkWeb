import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyticsHandler,
  createLinkHandler,
  redirectHandler,
} from "./serverless/handlers.js";
import type { LinkStore } from "./serverless/store.js";

function createResponse() {
  const result: {
    statusCode: number;
    headers: Record<string, string>;
    body?: unknown;
    destination?: string;
  } = { statusCode: 200, headers: {} };
  const response = {
    status(code: number) {
      result.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      result.headers[name] = value;
      return this;
    },
    json(payload: unknown) {
      result.body = payload;
      return this;
    },
    redirect(code: number, destination: string) {
      result.statusCode = code;
      result.destination = destination;
      return this;
    },
  };
  return { response, result };
}

function createStore(): LinkStore {
  return {
    createLink: vi.fn(async () => true),
    getDestination: vi.fn(async () => "https://maps.google.com/example"),
    recordClick: vi.fn(async () => undefined),
    getClickCount: vi.fn(async () => 3),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Vercel link API handlers", () => {
  it("accepts and stores the Google Maps URL", async () => {
    vi.stubEnv("PUBLIC_BASE_URL", "https://encurtador-link-web.vercel.app/");
    const store = createStore();
    const { response, result } = createResponse();
    const url = "https://www.google.com/maps/place/R.+Rio+de+Janeiro,+1230+-+Centro,+Belo+Horizonte+-+MG,+30160-041/data=!4m2!3m1!1s0xa699e16780d1c3:0xa0bf3d08d022a2d2?sa=X&ved=1t:242&ictx=111";

    await createLinkHandler(
      { method: "POST", body: { url }, query: {}, headers: {} },
      response,
      store,
    );

    expect(result.statusCode).toBe(201);
    expect(result.body).toMatchObject({
      slug: expect.any(String),
      shortUrl: expect.stringMatching(/^https:\/\/encurtador-link-web\.vercel\.app\/r\//),
    });
    expect(store.createLink).toHaveBeenCalledWith(
      expect.any(String),
      url,
      expect.any(String),
    );
  });

  it("rejects non-HTTP destinations", async () => {
    const { response, result } = createResponse();
    await createLinkHandler(
      { method: "POST", body: { url: "javascript:alert(1)" }, query: {}, headers: {} },
      response,
      createStore(),
    );

    expect(result.statusCode).toBe(400);
    expect(result.body).toEqual({ error: "Only HTTP and HTTPS URLs are supported" });
  });

  it("records a click before redirecting and returns analytics", async () => {
    const store = createStore();
    const request = {
      method: "GET",
      query: { slug: "abc123" },
      headers: { "user-agent": "test-agent", referer: "https://source.test/" },
    };
    const redirectResponse = createResponse();
    await redirectHandler(request, redirectResponse.response, store);

    expect(store.recordClick).toHaveBeenCalledWith(
      "abc123",
      expect.any(String),
      "test-agent",
      "https://source.test/",
    );
    expect(redirectResponse.result.statusCode).toBe(302);
    expect(redirectResponse.result.destination).toBe("https://maps.google.com/example");

    const analyticsResponse = createResponse();
    await analyticsHandler(request, analyticsResponse.response, store);
    expect(analyticsResponse.result.body).toEqual({ total: 3 });
  });
});