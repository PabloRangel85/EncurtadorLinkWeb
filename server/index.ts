import "dotenv/config";
import { resolve } from "node:path";
import { createApp } from "./app.js";
import { parseConfig } from "./config.js";
import { createDatabase } from "./database.js";

const config = parseConfig(process.env);
const database = await createDatabase(config.databasePath);
const app = await createApp({
	config,
	database,
	staticDir: resolve("dist/client"),
});

const close = async () => {
	await app.close();
	await database.close();
};

process.on("SIGINT", () => void close());
process.on("SIGTERM", () => void close());

await app.listen({ host: "0.0.0.0", port: config.port });