const config = {
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    pool: "threads",
    singleThread: true,
    coverage: {
      reporter: ["text", "html"],
    },
  },
};

export default config;
