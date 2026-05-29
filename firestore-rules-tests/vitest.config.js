import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Rules tests talk to a live emulator; run serially and give them headroom.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    include: ["tests/**/*.test.js"],
  },
});
