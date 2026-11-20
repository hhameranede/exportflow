import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "src/index.js",
      miniflare: {
        compatibilityDate: "2026-11-17",
      },
    }),
  ],
  test: {
    include: ["tests/workerd/**/*.workerd.test.js"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
