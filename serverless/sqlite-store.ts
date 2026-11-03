import { createDatabase } from "../server/database.js";

export interface LinkStore {
  createLink(slug: string, originalUrl: string, createdAt: string): Promise<boolean>;
  getDestination(slug: string): Promise<string | undefined>;
  recordClick(
    slug: string,
    clickedAt: string,
    userAgent: string | null,
    referrer: string | null,
  ): Promise<void>;
  getClickCount(slug: string): Promise<number | null>;
}

export interface SqliteLinkStore extends LinkStore {
  close(): Promise<void>;
}

export async function createSqliteStore(databasePath: string): Promise<SqliteLinkStore> {
  const database = await createDatabase(databasePath);

  return {
    async createLink(slug, originalUrl, createdAt) {
      try {
        await database.run(
          "INSERT INTO links (slug, original_url, created_at) VALUES (?, ?, ?)",
          slug,
          originalUrl,
          createdAt,
        );
        return true;
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          typeof error.code === "string" &&
          error.code.startsWith("SQLITE_CONSTRAINT")
        ) {
          return false;
        }
        throw error;
      }
    },
    async getDestination(slug) {
      const link = await database.get<{ original_url: string }>(
        "SELECT original_url FROM links WHERE slug = ?",
        slug,
      );
      return link?.original_url;
    },
    async recordClick(slug, clickedAt, userAgent, referrer) {
      await database.run(
        "INSERT INTO click_events (slug, clicked_at, user_agent, referrer) VALUES (?, ?, ?, ?)",
        slug,
        clickedAt,
        userAgent,
        referrer,
      );
    },
    async getClickCount(slug) {
      const link = await database.get<{ slug: string }>(
        "SELECT slug FROM links WHERE slug = ?",
        slug,
      );
      if (!link) return null;

      const result = await database.get<{ total: number }>(
        "SELECT COUNT(*) AS total FROM click_events WHERE slug = ?",
        slug,
      );
      return result?.total ?? 0;
    },
    close: () => database.close(),
  };
}

let serverlessStorePromise: Promise<SqliteLinkStore> | undefined;

export async function getServerlessStore(): Promise<LinkStore> {
  if (!serverlessStorePromise) {
    const databasePath = process.env.VERCEL === "1"
      ? "/tmp/tinyurl.sqlite"
      : process.env.DATABASE_PATH?.trim() || "./data/tinyurl.sqlite";
    serverlessStorePromise = createSqliteStore(databasePath);
  }

  try {
    return await serverlessStorePromise;
  } catch (error) {
    serverlessStorePromise = undefined;
    throw error;
  }
}