"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Migration runner — run with:
 *   npm run migrate
 *
 * This applies all SQL files in ./migrations/ to the database.
 * Generate new migrations after schema changes with:
 *   npx drizzle-kit generate:pg
 */
require("dotenv/config");
const node_postgres_1 = require("drizzle-orm/node-postgres");
const migrator_1 = require("drizzle-orm/node-postgres/migrator");
const pg_1 = require("pg");
const path_1 = __importDefault(require("path"));
async function main() {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL env var is required for migrations");
    }
    const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
    const db = (0, node_postgres_1.drizzle)(pool);
    console.log("▶ Running migrations…");
    await (0, migrator_1.migrate)(db, {
        migrationsFolder: path_1.default.join(__dirname, "migrations"),
    });
    console.log("✅ Migrations complete");
    await pool.end();
}
main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
