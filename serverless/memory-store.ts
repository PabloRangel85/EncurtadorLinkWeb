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

interface StoredLink {
  originalUrl: string;
  createdAt: string;
  clickCount: number;
}

export function createMemoryStore(): LinkStore {
  const links = new Map<string, StoredLink>();

  return {
    async createLink(slug, originalUrl, createdAt) {
      if (links.has(slug)) return false;
      links.set(slug, { originalUrl, createdAt, clickCount: 0 });
      return true;
    },
    async getDestination(slug) {
      return links.get(slug)?.originalUrl;
    },
    async recordClick(slug, _clickedAt, _userAgent, _referrer) {
      const link = links.get(slug);
      if (!link) throw new Error("Short link not found");
      link.clickCount += 1;
    },
    async getClickCount(slug) {
      const link = links.get(slug);
      return link ? link.clickCount : null;
    },
  };
}

const serverlessStore = createMemoryStore();

export async function getServerlessStore(): Promise<LinkStore> {
  return serverlessStore;
}