import "./load-env";
import { syncTse } from "../lib/tse-sync";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: npm run sync [--skip-photos] [--skip-details]

Full local sync when Vercel cron is blocked or you need fresh data:

  1. Import candidates, social links, and assets from TSE Open Data
  2. Enrich live fields (situação, urna, etc.) from DivulgaCand
  3. Backfill photo URLs and extract JPEGs from local TSE ZIPs
  4. Fetch nationality, birthplace, and proposal PDFs from DivulgaCand

Requires DATABASE_URL in .env.local.
Photo ZIPs: download SP/BR packs into data/tse-photos/ (see README).

Aliases:
  npm run sync:tse          Same TSE step without extra logging
  npm run sync:photos       Photos only
  npm run sync:details      Profile fields + proposal PDFs only
`);
  process.exit(0);
}

const skipPhotos = args.includes("--skip-photos");
const skipDetails = args.includes("--skip-details");

console.log(
  skipPhotos && skipDetails
    ? "Starting TSE sync (photos and details skipped)..."
    : skipPhotos
      ? "Starting TSE sync (photos skipped)..."
      : skipDetails
        ? "Starting TSE sync (details skipped)..."
        : "Starting full local sync...",
);

syncTse({ skipPhotos, skipDetails, onProgress: (message) => console.log(message) })
  .then((result) => {
    console.log("Sync completed.");
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error("Sync failed.", error);
    process.exitCode = 1;
  });
