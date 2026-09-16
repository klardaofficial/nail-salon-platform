import { defineConfig } from "vitest/config";

const config = defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    pool: "threads",
    fileParallelism: false,
    coverage: {
      reporter: ["text", "html"],
    },
  },
});

export default config;
