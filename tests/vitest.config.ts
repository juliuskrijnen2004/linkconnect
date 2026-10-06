const projectRoot = process.cwd().replaceAll("\\", "/");

const config = {
  resolve: {
    alias: {
      "@": projectRoot,
    },
  },
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true,
  },
};

export default config;
