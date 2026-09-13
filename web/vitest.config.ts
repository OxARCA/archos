import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: fromRoot("./") },
      // The real package throws outside a React Server Components build.
      { find: "server-only", replacement: fromRoot("./test/server-only.ts") },
    ],
  },
  test: {
    environment: "node",
    include: ["{app,lib}/**/*.test.ts"],
    // Starts a throwaway Postgres and points DATABASE_URL at it.
    globalSetup: ["./test/global-setup.ts"],
    clearMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
