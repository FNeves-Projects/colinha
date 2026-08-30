import "dotenv/config";
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");

  const migration = await readFile(new URL("../sql/001_initial.sql", import.meta.url), "utf8");
  const statements = migration
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  const sql = neon(connectionString);
  for (const statement of statements) {
    await sql.query(statement);
  }

  console.log(`Migration completed: ${statements.length} statements applied.`);
}

main().catch((error) => {
  console.error("Migration failed", error);
  process.exitCode = 1;
});
