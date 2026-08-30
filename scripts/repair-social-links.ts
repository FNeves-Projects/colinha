import "./load-env";
import { getSql } from "../lib/db";
import { normalizeSocialLink } from "../lib/social-links";

async function main() {
  const sql = getSql();
  const rows = await sql.query(
    `SELECT s.id::text, s.candidate_id::text, s.url
       FROM candidate_social_links s
       JOIN candidates c ON c.id = s.candidate_id
      WHERE c.election_year = 2026
      ORDER BY s.id`,
  ) as Array<{ id: string; candidate_id: string; url: string }>;

  const normalizedRows = new Map<string, { candidate_id: string; platform: string; url: string }>();
  let removed = 0;

  for (const row of rows) {
    const parsed = normalizeSocialLink(row.url);
    if (!parsed) {
      removed += 1;
      continue;
    }
    const key = `${row.candidate_id}\u0000${parsed.url}`;
    normalizedRows.set(key, {
      candidate_id: row.candidate_id,
      platform: parsed.platform,
      url: parsed.url,
    });
  }

  await sql.query(
    `DELETE FROM candidate_social_links
      WHERE candidate_id IN (
        SELECT id FROM candidates WHERE election_year = 2026 AND uf IN ('SP', 'BR')
      )`,
  );

  const payload = [...normalizedRows.values()];
  for (let index = 0; index < payload.length; index += 500) {
    await sql.query(
      `INSERT INTO candidate_social_links (candidate_id, platform, url)
       SELECT x.candidate_id::bigint, x.platform, x.url
         FROM jsonb_to_recordset($1::jsonb) AS x(
           candidate_id text, platform text, url text
         )
       ON CONFLICT (candidate_id, url) DO UPDATE SET platform = EXCLUDED.platform`,
      [JSON.stringify(payload.slice(index, index + 500))],
    );
  }

  console.log(JSON.stringify({
    scanned: rows.length,
    kept: payload.length,
    removed,
  }, null, 2));
}

main().catch((error) => {
  console.error("Social link repair failed", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
