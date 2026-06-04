import { drizzle } from "drizzle-orm/node-postgres";
import { Pool }    from "pg";
import * as schema from "./schema";

// One connection pool shared across the entire indexer process.
// The pool is lazy — no connections are opened until the first query.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Sensible defaults for an always-on indexer worker
  max:              10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("Postgres pool error:", err.message);
});

// Export the typed drizzle client — use this everywhere in the indexer
export const db = drizzle(pool, { schema });

// Export the raw pool too — used in blockTracker.ts rollback() for raw SQL
export { pool };