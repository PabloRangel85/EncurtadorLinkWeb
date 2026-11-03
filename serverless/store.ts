import { neon } from "@neondatabase/serverless";

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

type NeonClient = ReturnType<typeof neon<false, false>>;
let schemaPromise: Promise<void> | undefined;

async function ensureSchema(sql: NeonClient): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS links (
          slug TEXT PRIMARY KEY CHECK (char_length(slug) = 6),
          original_url TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS click_events (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          slug TEXT NOT NULL REFERENCES links(slug) ON DELETE CASCADE,
          clicked_at TIMESTAMPTZ NOT NULL,
          user_agent TEXT,
          referrer TEXT
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS click_events_slug_idx ON click_events(slug)`;
    })();
  }

  try {
    await schemaPromise;
  } catch (error) {
    schemaPromise = undefined;
    throw error;
  }
}

export async function createNeonStore(): Promise<LinkStore> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const sql = neon(databaseUrl);
  await ensureSchema(sql);

  return {
    async createLink(slug, originalUrl, createdAt) {
      const rows = await sql`
        INSERT INTO links (slug, original_url, created_at)
        VALUES (${slug}, ${originalUrl}, ${createdAt})
        ON CONFLICT (slug) DO NOTHING
        RETURNING slug
      `;
      return rows.length > 0;
    },
    async getDestination(slug) {
      const rows = await sql`SELECT original_url FROM links WHERE slug = ${slug}`;
      return rows[0]?.original_url as string | undefined;
    },
    async recordClick(slug, clickedAt, userAgent, referrer) {
      await sql`
        INSERT INTO click_events (slug, clicked_at, user_agent, referrer)
        VALUES (${slug}, ${clickedAt}, ${userAgent}, ${referrer})
      `;
    },
    async getClickCount(slug) {
      const rows = await sql`
        SELECT COUNT(*)::int AS total FROM click_events WHERE slug = ${slug}
      `;
      if (!rows[0]) return null;
      return Number(rows[0].total);
    },
  };
}