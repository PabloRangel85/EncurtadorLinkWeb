export interface AppConfig {
  publicBaseUrl: string;
  databasePath: string;
  port: number;
}

export function parseConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const publicBaseUrl = environment.PUBLIC_BASE_URL?.trim();
  const databasePath = environment.DATABASE_PATH?.trim() || "./data/tinyurl.sqlite";
  const port = Number(environment.PORT ?? 3000);

  if (!publicBaseUrl) {
    throw new Error("PUBLIC_BASE_URL is required");
  }

  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(publicBaseUrl);
  } catch {
    throw new Error("PUBLIC_BASE_URL must be an absolute HTTP or HTTPS URL");
  }

  if (!["http:", "https:"].includes(parsedBaseUrl.protocol)) {
    throw new Error("PUBLIC_BASE_URL must be an absolute HTTP or HTTPS URL");
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return {
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, ""),
    databasePath,
    port,
  };
}