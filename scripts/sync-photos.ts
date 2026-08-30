import "./load-env";
import { syncCandidatePhotosToBlob } from "../lib/candidate-photo-blob";

function parseLimitArg() {
  const raw = process.argv.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length)
    ?? process.argv[process.argv.indexOf("--limit") + 1];
  if (!raw || raw.startsWith("--")) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured. Copy .env.example to .env.local.");
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID)) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }

  const result = await syncCandidatePhotosToBlob({
    allowTseDownload: true,
    limit: parseLimitArg(),
    onProgress: (message) => console.log(message),
  });

  console.log("Photo sync completed", result);
  if (result.photoBlobFailedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Photo sync failed", error);
  process.exitCode = 1;
});
