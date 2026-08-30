import fs from "node:fs/promises";
import path from "node:path";
import { getSql } from "./db";
import {
  discoverLocalPhotoZipPaths,
  loadTsePhotoArchiveFromLocalFiles,
  LOCAL_PHOTO_ZIP_INSTRUCTIONS,
} from "./tse-photo-archive";
import { TSE_CANDIDATE_PHOTO_BASE } from "./tse-urls";

type CandidatePhotoRow = {
  id: string;
  sq_candidate: string;
  election_year: number;
  uf: string;
  photo_url: string | null;
};

export type CandidatePhotoSyncResult = {
  photoSyncEnabled: boolean;
  photoSyncLimit: number;
  photoSyncScannedCount: number;
  photoSyncWrittenCount: number;
  photoSyncSkippedCount: number;
  photoSyncFailedCount: number;
  photoSyncArchiveZipCount: number;
  photoSyncArchivePhotoCount: number;
  photoSyncArchiveErrors: string[];
  photoSyncLocalZipPaths: string[];
  photoSyncOutputDir: string;
  photoSyncErrors: string[];
  photoSyncSkippedOnVercel: boolean;
  photoSyncHint?: string;
};

export type CandidatePhotoSyncOptions = {
  allowTseDownload?: boolean;
  localZipPaths?: string[];
  limit?: number;
  concurrency?: number;
  onProgress?: (message: string) => void;
};

export const CANDIDATE_PHOTO_PUBLIC_PATH = "/candidate-photos";
export const CANDIDATE_PHOTO_OUTPUT_DIR = path.join(process.cwd(), "public/candidate-photos");

const DEFAULT_PHOTO_SYNC_LIMIT = 200;
const DEFAULT_LOCAL_PHOTO_SYNC_LIMIT = 20_000;
const DEFAULT_WRITE_CONCURRENCY = 8;
const LOCAL_SYNC_HINT =
  "Download TSE photo ZIPs in your browser, save them under data/tse-photos/, then run npm run sync:photos.";

function isRunningOnVercel() {
  return process.env.VERCEL === "1";
}

function parsePhotoSyncLimit(fallback: number) {
  const raw = process.env.CANDIDATE_PHOTO_SYNC_LIMIT;
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

export function candidatePhotoPublicUrl(sqCandidate: string, extension = "jpg") {
  return `${CANDIDATE_PHOTO_PUBLIC_PATH}/${sqCandidate}.${extension}`;
}

export function isLocalCandidatePhotoUrl(value: string | null) {
  return Boolean(value?.startsWith(`${CANDIDATE_PHOTO_PUBLIC_PATH}/`));
}

function extensionForContentType(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
) {
  const size = Math.max(1, concurrency);
  let nextIndex = 0;

  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => run()));
}

async function writePhotoFile(sqCandidate: string, bytes: Uint8Array, contentType: string) {
  await fs.mkdir(CANDIDATE_PHOTO_OUTPUT_DIR, { recursive: true });
  const extension = extensionForContentType(contentType);
  const filename = `${sqCandidate}.${extension}`;
  await fs.writeFile(path.join(CANDIDATE_PHOTO_OUTPUT_DIR, filename), bytes);
  return candidatePhotoPublicUrl(sqCandidate, extension);
}

export async function syncCandidatePhotos(
  options: CandidatePhotoSyncOptions = {},
): Promise<CandidatePhotoSyncResult> {
  const allowTseDownload = options.allowTseDownload ?? !isRunningOnVercel();
  const fallbackLimit = allowTseDownload ? DEFAULT_LOCAL_PHOTO_SYNC_LIMIT : DEFAULT_PHOTO_SYNC_LIMIT;
  const limit = options.limit ?? parsePhotoSyncLimit(fallbackLimit);
  const concurrency = options.concurrency ?? DEFAULT_WRITE_CONCURRENCY;
  const log = options.onProgress ?? (() => undefined);

  const result: CandidatePhotoSyncResult = {
    photoSyncEnabled: allowTseDownload,
    photoSyncLimit: limit,
    photoSyncScannedCount: 0,
    photoSyncWrittenCount: 0,
    photoSyncSkippedCount: 0,
    photoSyncFailedCount: 0,
    photoSyncArchiveZipCount: 0,
    photoSyncArchivePhotoCount: 0,
    photoSyncArchiveErrors: [],
    photoSyncLocalZipPaths: [],
    photoSyncOutputDir: CANDIDATE_PHOTO_OUTPUT_DIR,
    photoSyncErrors: [],
    photoSyncSkippedOnVercel: !allowTseDownload,
  };

  if (!allowTseDownload) {
    result.photoSyncHint = LOCAL_SYNC_HINT;
    return result;
  }

  if (limit === 0) return result;

  const sql = getSql();
  const rows = await sql.query(
    `SELECT id::text, sq_candidate, election_year, uf, photo_url
       FROM candidates
      WHERE election_year = 2026
        AND uf IN ('SP', 'BR')
        AND source = 'TSE'
        AND sq_candidate ~ '^[0-9]+$'
        AND (
          photo_url IS NULL
          OR photo_url = ''
          OR photo_url LIKE '/assets/%'
          OR photo_url LIKE $1 || '/%'
          OR photo_url LIKE '%public.blob.vercel-storage.com/%'
          OR photo_url NOT LIKE $2 || '/%'
        )
      ORDER BY
        CASE WHEN sq_candidate = '250002530169' THEN 0 ELSE 1 END,
        office_code,
        ballot_name
      LIMIT $3`,
    [TSE_CANDIDATE_PHOTO_BASE, CANDIDATE_PHOTO_PUBLIC_PATH, limit],
  ) as CandidatePhotoRow[];

  result.photoSyncScannedCount = rows.length;
  if (!rows.length) return result;

  const pendingRows = rows.filter((row) => !isLocalCandidatePhotoUrl(row.photo_url));
  result.photoSyncSkippedCount = rows.length - pendingRows.length;
  log(`Pending photos: ${pendingRows.length}`);

  const localZipPaths = discoverLocalPhotoZipPaths(options.localZipPaths ?? []);
  result.photoSyncLocalZipPaths = localZipPaths;

  if (!localZipPaths.length) {
    result.photoSyncHint = LOCAL_PHOTO_ZIP_INSTRUCTIONS;
    throw new Error(LOCAL_PHOTO_ZIP_INSTRUCTIONS);
  }

  log(`Loading local photo ZIPs:\n${localZipPaths.map((filePath) => `  - ${filePath}`).join("\n")}`);
  const archiveLoad = await loadTsePhotoArchiveFromLocalFiles(
    localZipPaths,
    pendingRows.map((row) => row.sq_candidate),
  );
  result.photoSyncArchiveZipCount = archiveLoad.loadedZipCount;
  result.photoSyncArchivePhotoCount = archiveLoad.loadedPhotoCount;
  result.photoSyncArchiveErrors = archiveLoad.errors.slice(0, 4);
  log(`Photos extracted from ZIPs: ${archiveLoad.loadedPhotoCount}/${pendingRows.length}`);

  if (archiveLoad.loadedPhotoCount === 0) {
    result.photoSyncHint = LOCAL_PHOTO_ZIP_INSTRUCTIONS;
    throw new Error(
      `No photos found in local ZIP files. ${archiveLoad.errors.join("; ") || LOCAL_PHOTO_ZIP_INSTRUCTIONS}`,
    );
  }

  log(`Writing to ${CANDIDATE_PHOTO_OUTPUT_DIR} (${concurrency} at a time)...`);

  await mapPool(pendingRows, concurrency, async (row, index) => {
    const position = index + 1;
    const archived = archiveLoad.archive.get(row.sq_candidate);
    if (!archived) {
      result.photoSyncFailedCount += 1;
      if (result.photoSyncErrors.length < 8) {
        result.photoSyncErrors.push(`${row.sq_candidate}: not found in local photo ZIPs`);
      }
      if (result.photoSyncFailedCount <= 8 || position % 25 === 0) {
        log(`missing ${position}/${pendingRows.length} ${row.sq_candidate}`);
      }
      return;
    }

    try {
      const photoUrl = await writePhotoFile(row.sq_candidate, archived.bytes, archived.contentType);
      await sql.query(
        `UPDATE candidates SET photo_url = $2, updated_at = now() WHERE id = $1`,
        [row.id, photoUrl],
      );
      result.photoSyncWrittenCount += 1;
      if (position <= 5 || position % 25 === 0 || position === pendingRows.length) {
        log(`ok ${position}/${pendingRows.length} ${row.sq_candidate}`);
      }
    } catch (error) {
      result.photoSyncFailedCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      if (result.photoSyncErrors.length < 8) {
        result.photoSyncErrors.push(`${row.sq_candidate}: ${message.slice(0, 240)}`);
      }
      if (result.photoSyncFailedCount <= 8 || position % 25 === 0) {
        log(`fail ${position}/${pendingRows.length} ${row.sq_candidate}: ${message.slice(0, 160)}`);
      }
    }
  });

  return result;
}

export async function repairCandidatePhotoUrls() {
  const sql = getSql();
  const rows = await sql.query(
    `UPDATE candidates
        SET photo_url = $1 || '/' || sq_candidate || '.jpg',
            updated_at = now()
      WHERE election_year = 2026
        AND uf IN ('SP', 'BR')
        AND sq_candidate ~ '^[0-9]+$'
        AND (
          photo_url IS NULL
          OR photo_url = ''
          OR photo_url NOT LIKE $1 || '/%'
        )
      RETURNING sq_candidate`,
    [CANDIDATE_PHOTO_PUBLIC_PATH],
  ) as Array<{ sq_candidate: string }>;
  return rows.length;
}
