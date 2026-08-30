import dns from "node:dns";
import "./load-env";
import { syncCandidatePhotosToBlob } from "../lib/candidate-photo-blob";

dns.setDefaultResultOrder("ipv4first");

function parseLimitArg() {
  const raw = process.argv.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length)
    ?? process.argv[process.argv.indexOf("--limit") + 1];
  if (!raw || raw.startsWith("--")) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined;
}

function log(message: string) {
  console.log(message);
  if (process.stdout.isTTY === false) {
    process.stdout.write("");
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured. Copy .env.example to .env.local.");
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID)) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }

  const useZip = process.argv.includes("--zip");
  log(useZip ? "Photo ZIP archives enabled." : "Downloading photos one by one (Ctrl+C to stop).");

  const result = await syncCandidatePhotosToBlob({
    allowTseDownload: true,
    skipZip: !useZip,
    limit: parseLimitArg(),
    onProgress: log,
  });

  log(`Photo sync completed ${JSON.stringify(result, null, 2)}`);
  if (result.photoBlobFailedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Photo sync failed", error);
  process.exitCode = 1;
});
