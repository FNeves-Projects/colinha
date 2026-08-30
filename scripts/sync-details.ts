import "./load-env";
import { syncCandidateDetails } from "../lib/candidate-detail-sync";

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

syncCandidateDetails({
  limit: parseLimitArg(),
  forceDownload: args.includes("--force-download"),
  onProgress: (message) => console.log(message),
})
  .then((result) => {
    console.log("Detail sync completed.");
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error("Detail sync failed.", error);
    process.exitCode = 1;
  });
