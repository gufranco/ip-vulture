import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/__tests__/**", "src/server.ts"],
      thresholds: {
        statements: 95,
        branches: 93,
        functions: 95,
        lines: 95,
      },
    },
  },
});
