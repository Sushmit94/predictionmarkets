/**
 * Migration runner — run with:
 *   npm run migrate
 *
 * This applies all SQL files in ./migrations/ to the database.
 * Generate new migrations after schema changes with:
 *   npx drizzle-kit generate:pg
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate }  from "drizzle-orm/node-postgres/migrator";
import { Pool }     from "pg";
import path         from "path";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL env var is required for migrations");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db   = drizzle(pool);

  console.log("▶ Running migrations…");

  await migrate(db, {
    migrationsFolder: path.join(__dirname, "migrations"),
  });

  console.log("✅ Migrations complete");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});