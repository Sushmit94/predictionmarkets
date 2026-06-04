import type { Config } from "drizzle-kit";

export default {
  schema:    "./src/db/schema.ts",
  out:       "./src/db/migrations",
  dialect:   "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // Verbose output so you can see exactly what SQL is generated
  verbose: true,
  strict:  true,
} satisfies Config;