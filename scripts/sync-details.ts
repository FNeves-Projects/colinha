import "./load-env";
import { syncCandidateDetails } from "../lib/candidate-detail-sync";
import { getSql } from "../lib/db";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: npm run sync:details [--limit=N] [--force-download]

Fetch DivulgaCand profile fields (nationality, birthplace, gender, marital status)
and proposal PDFs for candidates already in Neon.

Writes PDFs to public/candidate-proposals/ and updates candidate_proposals.

Requires DATABASE_URL in .env.local.
Skipped automatically on Vercel (TSE blocks datacenter IPs).

Flags:
  --limit=N          Max candidates to scan (default: CANDIDATE_DETAIL_SYNC_LIMIT or 20000)
  --force-download   Re-download PDFs even when cached locally
`);
  process.exit(0);
}

function parseLimitArg() {
  const raw = args.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length)
    ?? args[args.indexOf("--limit") + 1];
  if (!raw || raw.startsWith("--")) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined;
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not configured. Copy .env.example to .env.local.");
  process.exit(1);
}

console.log("Starting candidate detail + proposal PDF sync...");

async function main() {
  const sql = getSql();
  const runRows = await sql.query(
    `INSERT INTO sync_runs (source, status, details)
     VALUES ('TSE', 'running', '{"mode":"candidate-details"}'::jsonb)
     RETURNING id::text`,
  ) as Array<{ id: string }>;
  const runId = runRows[0].id;

  try {
    const result = await syncCandidateDetails({
      limit: parseLimitArg(),
      forceDownload: args.includes("--force-download"),
      onProgress: (message) => console.log(message),
    });
    const details = { mode: "candidate-details", ...result };
    await sql.query(
      `UPDATE sync_runs
          SET status = 'success', finished_at = now(), details = $2::jsonb
        WHERE id = $1`,
      [runId, JSON.stringify(details)],
    );
    console.log("Detail sync completed.");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sql.query(
      `UPDATE sync_runs
          SET status = 'failed', finished_at = now(), error_message = $2
        WHERE id = $1`,
      [runId, message.slice(0, 2000)],
    );
    throw error;
  }
}

main().catch((error) => {
  console.error("Detail sync failed.", error);
  process.exitCode = 1;
});
