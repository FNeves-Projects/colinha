import { fileURLToPath } from "node:url";
import "./load-env";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");

  const sqlDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../sql");
  const files = (await readdir(sqlDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const sql = neon(connectionString);
  for (const file of files) {
    const migration = await readFile(path.join(sqlDir, file), "utf8");
    const statements = migration
      .split(/;\s*(?:\n|$)/)
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await sql.query(statement);
    }

    console.log(`Applied ${file}: ${statements.length} statements.`);
  }

  console.log(`Migration completed: ${files.length} files.`);
}

main().catch((error) => {
  console.error("Migration failed", error);
  process.exitCode = 1;
});
