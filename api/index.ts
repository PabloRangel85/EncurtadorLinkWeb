import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  analyticsHandler,
  createLinkHandler,
  redirectHandler,
} from "../serverless/handlers.js";
import { getServerlessStore } from "../serverless/sqlite-store.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const route = request.query.route;
  const slug = request.query.slug;

  if (route !== "create" && route !== "analytics" && route !== "redirect") {
    return response.status(404).json({ error: "Not found" });
  }

  try {
    const store = await getServerlessStore();
    const apiRequest = {
      method: request.method,
      body: request.body,
      query: { ...request.query, slug },
      headers: request.headers,
    };

    if (route === "create") {
      return await createLinkHandler(apiRequest, response, store);
    }
    if (route === "analytics") {
      return await analyticsHandler(apiRequest, response, store);
    }
    return await redirectHandler(apiRequest, response, store);
  } catch (error) {
    console.error("Could not initialize link service", error);
    return response.status(500).json({ error: "Could not initialize the SQLite database" });
  }
}