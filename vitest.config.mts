import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // "server-only" wirft außerhalb von React Server Components; im Test reicht ein Leermodul.
    alias: {
      "server-only": new URL("./src/test/empty.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
