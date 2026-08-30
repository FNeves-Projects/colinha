import dns from "node:dns";
import os from "node:os";
import path from "node:path";
import "./load-env";
import { syncCandidatePhotos } from "../lib/candidate-photo-sync";
import {
  discoverLocalPhotoZipPaths,
  ensureTsePhotoZipFiles,
  inspectLocalPhotoZip,
  LOCAL_PHOTO_ZIP_INSTRUCTIONS,
  TSE_PHOTO_DATASET_URL,
  validateLocalPhotoZipPaths,
} from "../lib/tse-photo-archive";

dns.setDefaultResultOrder("ipv4first");

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function parseLimitArg() {
  const raw = process.argv.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length)
    ?? process.argv[process.argv.indexOf("--limit") + 1];
  if (!raw || raw.startsWith("--")) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined;
}

function parseInspectZipArg() {
  const inline = process.argv.find((arg) => arg.startsWith("--inspect-zip="))?.slice("--inspect-zip=".length);
  if (inline) return inline;

  const index = process.argv.indexOf("--inspect-zip");
  if (index >= 0) {
    const next = process.argv[index + 1];
    if (next && !next.startsWith("--")) return next;
  }
  return undefined;
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

async function resolvePhotoZipPaths() {
  const explicitZipPaths = parseZipFileArgs();
  if (explicitZipPaths.length) {
    const resolved = validateLocalPhotoZipPaths(explicitZipPaths);
    for (const missing of resolved.missing) {
      log(`Skipping missing ZIP (optional): ${missing}`);
    }
    return resolved.existing;
  }

  if (hasFlag("--local-only")) {
    return discoverLocalPhotoZipPaths();
  }

  log("Step 1/3: downloading TSE photo ZIPs (SP required, BR optional)...");
  const ensured = await ensureTsePhotoZipFiles({
    forceDownload: hasFlag("--force-download"),
    onProgress: log,
  });

  if (!ensured.zipPaths.length) {
    log("Automatic download failed.");
    if (ensured.errors.length) {
      log(ensured.errors.map((entry) => `  - ${entry}`).join("\n"));
    }
    log("");
    log(`Portal fallback: ${TSE_PHOTO_DATASET_URL}`);
    log(LOCAL_PHOTO_ZIP_INSTRUCTIONS);
    return [];
  }

  log(`ZIPs ready: ${ensured.zipPaths.length} (downloaded ${ensured.downloaded.length}, cached ${ensured.reused.length})`);
  return ensured.zipPaths;
}

async function main() {
  const inspectTarget = parseInspectZipArg();
  if (inspectTarget) {
    const report = inspectLocalPhotoZip(inspectTarget);
    log(JSON.stringify(report, null, 2));
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured. Copy .env.example to .env.local.");
  }

  const localZipPaths = await resolvePhotoZipPaths();
  if (!localZipPaths.length) {
    log(`Home directory: ${os.homedir()}`);
    log(`Project folder: ${process.cwd()}`);
    log(`Cache folder: ${path.join(process.cwd(), "data/tse-photos")}`);
    process.exitCode = 1;
    return;
  }

  log("Step 2/3: extracting photos from ZIPs...");
  log("Step 3/3: writing to public/candidate-photos and updating Neon...");

  const result = await syncCandidatePhotos({
    allowTseDownload: true,
    localZipPaths,
    limit: parseLimitArg(),
    onProgress: log,
  });

  log(`Photo sync completed ${JSON.stringify(result, null, 2)}`);
  if (result.photoSyncFailedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Photo sync failed", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
