import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` throws outside the React Server environment; server
      // modules are unit-tested as plain functions.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/features/**"],
    },
  },
});
