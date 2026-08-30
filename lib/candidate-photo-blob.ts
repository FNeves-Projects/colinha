import { put } from "@vercel/blob";
import { getSql } from "./db";
import { loadTsePhotoArchive } from "./tse-photo-archive";
import { fetchTse, TSE_PHOTO_FETCH_TIMEOUT_MS } from "./tse-fetch";
import {
  TSE_CANDIDATE_PHOTO_BASE,
  TSE_ELECTION_ID_2026,
  tseCandidatePhotoDownloadUrl,
  tseCandidatePhotoUrl,
} from "./tse-urls";

type CandidatePhotoRow = {
  id: string;
  sq_candidate: string;
  election_year: number;
  uf: string;
  photo_url: string | null;
};

export type CandidatePhotoBlobSyncResult = {
  photoBlobEnabled: boolean;
  photoBlobLimit: number;
  photoBlobScannedCount: number;
  photoBlobUploadedCount: number;
  photoBlobSkippedCount: number;
  photoBlobFailedCount: number;
  photoBlobArchiveZipCount: number;
  photoBlobArchivePhotoCount: number;
  photoBlobArchiveErrors: string[];
  photoBlobErrors: string[];
  photoBlobSkippedOnVercel: boolean;
  photoBlobHint?: string;
};

export type CandidatePhotoBlobSyncOptions = {
  /** Local machines can reach TSE; Vercel datacenter IPs get HTTP 403. */
  allowTseDownload?: boolean;
  skipZip?: boolean;
  limit?: number;
  concurrency?: number;
  onProgress?: (message: string) => void;
};

const DEFAULT_PHOTO_SYNC_LIMIT = 200;
const DEFAULT_LOCAL_PHOTO_SYNC_LIMIT = 20_000;
const PHOTO_UPLOAD_CACHE_SECONDS = 31_536_000;
const DEFAULT_FETCH_CONCURRENCY = 6;
const PUBLIC_BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";
const LOCAL_SYNC_HINT =
  "TSE/Akamai blocks Vercel IPs with HTTP 403. Run `npm run sync:photos` from a local machine that can open the photo URL.";

function hasBlobCredentials() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN
    || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID),
  );
}

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

function isPublicBlobUrl(value: string | null) {
  if (!value) return false;
  try {
    return new URL(value).hostname.endsWith(PUBLIC_BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

function isHttpUrl(value: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function uniqueUrls(urls: Array<string | null>) {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}

function extensionForContentType(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

function blobPathname(row: CandidatePhotoRow, extension: string) {
  return `candidate-photos/${TSE_ELECTION_ID_2026}/${row.uf}/${row.sq_candidate}.${extension}`;
}

function toNodeBuffer(bytes: ArrayBuffer | Uint8Array) {
  return Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
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

async function uploadPhotoBytes(row: CandidatePhotoRow, bytes: ArrayBuffer | Uint8Array, contentType: string) {
  const extension = extensionForContentType(contentType);
  const pathname = blobPathname(row, extension);
  const blob = await put(pathname, toNodeBuffer(bytes), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: PHOTO_UPLOAD_CACHE_SECONDS,
    contentType,
  });
  return blob.url;
}

async function fetchCandidatePhotoFromUrls(row: CandidatePhotoRow) {
  const uf = row.uf === "BRASIL" ? "BR" : row.uf;
  const urls = uniqueUrls([
    tseCandidatePhotoDownloadUrl(row.sq_candidate, uf),
    isHttpUrl(row.photo_url) && !isPublicBlobUrl(row.photo_url) ? row.photo_url : null,
    tseCandidatePhotoUrl(row.sq_candidate),
  ]);

  const errors: string[] = [];
  for (const url of urls) {
    try {
      const response = await fetchTse(url, TSE_PHOTO_FETCH_TIMEOUT_MS);

      const contentType = response.headers.get("content-type")?.split(";")[0]?.toLowerCase() ?? "";
      if (!response.ok) {
        errors.push(`${response.status} ${url}`);
        continue;
      }
      if (!contentType.startsWith("image/")) {
        errors.push(`non-image ${contentType || "unknown"} ${url}`);
        continue;
      }

      return {
        bytes: await response.arrayBuffer(),
        contentType,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${message.slice(0, 120)} ${url}`);
    }
  }

  throw new Error(errors.join("; ") || `Unable to fetch photo for ${row.sq_candidate}`);
}

async function uploadCandidatePhoto(
  row: CandidatePhotoRow,
  archive: Map<string, { bytes: Uint8Array; contentType: string }>,
) {
  const archived = archive.get(row.sq_candidate);
  if (archived) {
    return uploadPhotoBytes(row, archived.bytes, archived.contentType);
  }

  const fetched = await fetchCandidatePhotoFromUrls(row);
  return uploadPhotoBytes(row, fetched.bytes, fetched.contentType);
}

export async function syncCandidatePhotosToBlob(
  options: CandidatePhotoBlobSyncOptions = {},
): Promise<CandidatePhotoBlobSyncResult> {
  const allowTseDownload = options.allowTseDownload ?? !isRunningOnVercel();
  const skipZip = options.skipZip ?? true;
  const fallbackLimit = allowTseDownload ? DEFAULT_LOCAL_PHOTO_SYNC_LIMIT : DEFAULT_PHOTO_SYNC_LIMIT;
  const limit = options.limit ?? parsePhotoSyncLimit(fallbackLimit);
  const concurrency = options.concurrency ?? DEFAULT_FETCH_CONCURRENCY;
  const log = options.onProgress ?? (() => undefined);

  const result: CandidatePhotoBlobSyncResult = {
    photoBlobEnabled: hasBlobCredentials(),
    photoBlobLimit: limit,
    photoBlobScannedCount: 0,
    photoBlobUploadedCount: 0,
    photoBlobSkippedCount: 0,
    photoBlobFailedCount: 0,
    photoBlobArchiveZipCount: 0,
    photoBlobArchivePhotoCount: 0,
    photoBlobArchiveErrors: [],
    photoBlobErrors: [],
    photoBlobSkippedOnVercel: !allowTseDownload,
  };

  if (!allowTseDownload) {
    result.photoBlobHint = LOCAL_SYNC_HINT;
    return result;
  }

  if (!result.photoBlobEnabled || limit === 0) return result;

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
          OR photo_url NOT LIKE '%public.blob.vercel-storage.com/%'
        )
      ORDER BY
        CASE WHEN sq_candidate = '250002530169' THEN 0 ELSE 1 END,
        office_code,
        ballot_name
      LIMIT $2`,
    [TSE_CANDIDATE_PHOTO_BASE, limit],
  ) as CandidatePhotoRow[];

  result.photoBlobScannedCount = rows.length;
  if (!rows.length) return result;

  const pendingRows = rows.filter((row) => !isPublicBlobUrl(row.photo_url));
  result.photoBlobSkippedCount = rows.length - pendingRows.length;
  log(`Pending photos: ${pendingRows.length}`);

  let archive = new Map<string, { bytes: Uint8Array; contentType: string }>();
  if (skipZip) {
    log("Skipping TSE photo ZIPs; downloading individual photos.");
  } else {
    const archiveLoad = await loadTsePhotoArchive(
      pendingRows.map((row) => row.sq_candidate),
      pendingRows.map((row) => row.uf),
    );
    result.photoBlobArchiveZipCount = archiveLoad.loadedZipCount;
    result.photoBlobArchivePhotoCount = archiveLoad.loadedPhotoCount;
    result.photoBlobArchiveErrors = archiveLoad.errors.slice(0, 4);
    log(`Photo ZIP archives loaded: ${archiveLoad.loadedZipCount} (${archiveLoad.loadedPhotoCount} photos)`);
    archive = archiveLoad.archive;
  }

  log(`Starting downloads (${concurrency} at a time)...`);

  await mapPool(pendingRows, concurrency, async (row, index) => {
    const position = index + 1;
    if (position <= 5) {
      log(`fetch ${position}/${pendingRows.length} ${row.sq_candidate}`);
    }
    try {
      const blobUrl = await uploadCandidatePhoto(row, archive);
      await sql.query(
        `UPDATE candidates SET photo_url = $2, updated_at = now() WHERE id = $1`,
        [row.id, blobUrl],
      );
      result.photoBlobUploadedCount += 1;
      if (position <= 5 || position % 10 === 0 || position === pendingRows.length) {
        log(`ok ${position}/${pendingRows.length} ${row.sq_candidate}`);
      }
    } catch (error) {
      result.photoBlobFailedCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      if (result.photoBlobErrors.length < 8) {
        result.photoBlobErrors.push(`${row.sq_candidate}: ${message.slice(0, 240)}`);
      }
      if (result.photoBlobFailedCount <= 8 || position % 25 === 0) {
        log(`fail ${position}/${pendingRows.length} ${row.sq_candidate}: ${message.slice(0, 160)}`);
      }
    }
  });

  return result;
}
