import "./load-env";
import { getSql } from "../lib/db";
import { tseCandidateUrl } from "../lib/tse-urls";

async function main() {
  const sql = getSql();
  const rows = await sql.query(
    `SELECT id::text, sq_candidate, uf, election_year, tse_url
       FROM candidates
      WHERE election_year = 2026
        AND uf IN ('SP', 'BR')
        AND sq_candidate ~ '^[0-9]+$'`,
  ) as Array<{ id: string; sq_candidate: string; uf: string; election_year: number; tse_url: string | null }>;

  let updated = 0;
  for (const row of rows) {
    const nextUrl = tseCandidateUrl(row.uf, row.sq_candidate, row.election_year);
    if (row.tse_url === nextUrl) continue;
    await sql.query(
      `UPDATE candidates SET tse_url = $2, updated_at = now() WHERE id = $1`,
      [row.id, nextUrl],
    );
    updated += 1;
  }

  console.log(JSON.stringify({
    scanned: rows.length,
    updated,
    sample: tseCandidateUrl("SP", "250002530169"),
  }, null, 2));
}

main().catch((error) => {
  console.error("TSE URL repair failed", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
