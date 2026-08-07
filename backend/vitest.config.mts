import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

// Loaded here (not in a setupFile) so DATABASE_URL etc. are set on
// process.env before any test file imports lib/prisma -- PrismaClient reads
// the connection string once, at construction time.
dotenv.config({ path: ".env.test" });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 15000,
    fileParallelism: false, // integration tests share one MySQL database
  },
});
