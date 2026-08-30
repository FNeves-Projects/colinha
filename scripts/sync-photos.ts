import dns from "node:dns";
import "./load-env";
import { syncCandidatePhotosToBlob } from "../lib/candidate-photo-blob";
import { discoverLocalPhotoZipPaths } from "../lib/tse-photo-archive";

dns.setDefaultResultOrder("ipv4first");

function parseLimitArg() {
  const raw = process.argv.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length)
    ?? process.argv[process.argv.indexOf("--limit") + 1];
  if (!raw || raw.startsWith("--")) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined;
}

function parseZipFileArgs() {
  const paths: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg.startsWith("--zip-file=")) {
      paths.push(arg.slice("--zip-file=".length));
      continue;
    }
    if (arg === "--zip-file") {
      const next = process.argv[index + 1];
      if (next && !next.startsWith("--")) paths.push(next);
    }
  }
  return paths;
}

function log(message: string) {
  console.log(message);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured. Copy .env.example to .env.local.");
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID)) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }

  const localZipPaths = discoverLocalPhotoZipPaths(parseZipFileArgs());
  if (!localZipPaths.length) {
    log("No local photo ZIP files found.");
    log("Download in your browser and save under data/tse-photos/:");
    log("  https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_SP.zip");
    log("  https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_BR.zip");
    log("Or pass: npm run sync:photos -- --zip-file /path/to/foto_cand2026_SP.zip");
    process.exitCode = 1;
    return;
  }

  const result = await syncCandidatePhotosToBlob({
    allowTseDownload: true,
    localZipPaths,
    limit: parseLimitArg(),
    onProgress: log,
  });

  log(`Photo sync completed ${JSON.stringify(result, null, 2)}`);
  if (result.photoBlobFailedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Photo sync failed", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
