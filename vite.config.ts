import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const clientRoot = fileURLToPath(new URL("./src/client", import.meta.url));

export default defineConfig({
  root: clientRoot,
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/r": "http://localhost:3000",
    },
  },
  build: {
    outDir: resolve(clientRoot, "../../dist/client"),
    emptyOutDir: true,
  },
});