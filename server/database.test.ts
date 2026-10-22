import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDatabase } from "./database.js";

describe("SQLite initialization", () => {
  it("is idempotent and preserves records", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tinyurl-test-"));
    const databasePath = join(directory, "links.sqlite");
    const firstConnection = await createDatabase(databasePath);
    await firstConnection.run(
      "INSERT INTO links (slug, original_url, created_at) VALUES (?, ?, ?)",
      "abc123",
      "https://example.com/",
      new Date().toISOString(),
    );
    await firstConnection.close();

    const secondConnection = await createDatabase(databasePath);
    const link = await secondConnection.get<{ original_url: string }>(
      "SELECT original_url FROM links WHERE slug = ?",
      "abc123",
    );
    await secondConnection.close();
    await rm(directory, { recursive: true, force: true });

    expect(link?.original_url).toBe("https://example.com/");
  });
});