import { describe, expect, it } from "vitest";
import { parseConfig } from "./config.js";

describe("application configuration", () => {
  it("parses an HTTP base URL and default database path", () => {
    expect(parseConfig({ PUBLIC_BASE_URL: "https://short.test/", PORT: "3001" })).toEqual({
      publicBaseUrl: "https://short.test",
      databasePath: "./data/tinyurl.sqlite",
      port: 3001,
    });
  });

  it.each([
    [{}, "PUBLIC_BASE_URL is required"],
    [{ PUBLIC_BASE_URL: "mailto:team@example.test" }, "PUBLIC_BASE_URL must be an absolute HTTP or HTTPS URL"],
    [{ PUBLIC_BASE_URL: "https://short.test", PORT: "70000" }, "PORT must be an integer between 1 and 65535"],
  ])("rejects invalid configuration", (environment, message) => {
    expect(() => parseConfig(environment)).toThrow(message);
  });
});