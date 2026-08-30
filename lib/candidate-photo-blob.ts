import { put } from "@vercel/blob";
import { getSql } from "./db";
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
  photoBlobErrors: string[];
};

const DEFAULT_PHOTO_SYNC_LIMIT = 200;
const PHOTO_FETCH_TIMEOUT_MS = 20_000;
const PHOTO_UPLOAD_CACHE_SECONDS = 31_536_000;
const PUBLIC_BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

function hasBlobCredentials() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN
    || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID),
  );
}

function parsePhotoSyncLimit() {
  const raw = process.env.CANDIDATE_PHOTO_SYNC_LIMIT;
  if (!raw) return DEFAULT_PHOTO_SYNC_LIMIT;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_PHOTO_SYNC_LIMIT;
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

async function fetchCandidatePhoto(row: CandidatePhotoRow) {
  const uf = row.uf === "BRASIL" ? "BR" : row.uf;
  const urls = uniqueUrls([
    tseCandidatePhotoDownloadUrl(row.sq_candidate, uf),
    isHttpUrl(row.photo_url) && !isPublicBlobUrl(row.photo_url) ? row.photo_url : null,
    tseCandidatePhotoUrl(row.sq_candidate),
  ]);

  const errors: string[] = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
          "User-Agent": "ColinhaDigital/1.0 (candidate-photo-cache)",
        },
        signal: AbortSignal.timeout(PHOTO_FETCH_TIMEOUT_MS),
      });

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

async function uploadCandidatePhoto(row: CandidatePhotoRow) {
  const photo = await fetchCandidatePhoto(row);
  const extension = extensionForContentType(photo.contentType);
  const pathname = `candidate-photos/${TSE_ELECTION_ID_2026}/${row.uf}/${row.sq_candidate}.${extension}`;
  const blob = await put(pathname, new Blob([photo.bytes], { type: photo.contentType }), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: PHOTO_UPLOAD_CACHE_SECONDS,
    contentType: photo.contentType,
  });

  return blob.url;
}

export async function syncCandidatePhotosToBlob(): Promise<CandidatePhotoBlobSyncResult> {
  const limit = parsePhotoSyncLimit();
  const result: CandidatePhotoBlobSyncResult = {
    photoBlobEnabled: hasBlobCredentials(),
    photoBlobLimit: limit,
    photoBlobScannedCount: 0,
    photoBlobUploadedCount: 0,
    photoBlobSkippedCount: 0,
    photoBlobFailedCount: 0,
    photoBlobErrors: [],
  };

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

  for (const row of rows) {
    if (isPublicBlobUrl(row.photo_url)) {
      result.photoBlobSkippedCount += 1;
      continue;
    }

    try {
      const blobUrl = await uploadCandidatePhoto(row);
      await sql.query(
        `UPDATE candidates SET photo_url = $2, updated_at = now() WHERE id = $1`,
        [row.id, blobUrl],
      );
      result.photoBlobUploadedCount += 1;
    } catch (error) {
      result.photoBlobFailedCount += 1;
      if (result.photoBlobErrors.length < 8) {
        const message = error instanceof Error ? error.message : String(error);
        result.photoBlobErrors.push(`${row.sq_candidate}: ${message.slice(0, 240)}`);
      }
    }
  }

  return result;
}
