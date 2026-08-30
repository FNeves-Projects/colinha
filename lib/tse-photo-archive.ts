import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { fetchTse, TSE_PHOTO_ZIP_TIMEOUT_MS } from "./tse-fetch";

export type TsePhotoAsset = {
  bytes: Uint8Array;
  contentType: string;
};

export type TsePhotoArchiveLoadResult = {
  archive: Map<string, TsePhotoAsset>;
  loadedZipCount: number;
  loadedPhotoCount: number;
  errors: string[];
  localZipPaths: string[];
};

export const DEFAULT_LOCAL_PHOTO_ZIP_DIR = "data/tse-photos";

const DEFAULT_LOCAL_PHOTO_ZIP_NAMES = [
  "foto_cand2026_SP.zip",
  "foto_cand2026_SP_div.zip",
  "foto_cand2026_BR.zip",
  "foto_cand2026_BR_div.zip",
] as const;

const DEFAULT_PHOTO_ZIP_URLS = [
  "https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_SP.zip",
  "https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_SP_div.zip",
  "https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_BR.zip",
  "https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_BR_div.zip",
  "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_SP.zip",
  "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_SP_div.zip",
  "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_BR.zip",
  "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_BR_div.zip",
];

export const LOCAL_PHOTO_ZIP_INSTRUCTIONS = [
  "TSE/Akamai blocks scripted downloads (HTTP 403) even on residential IPs.",
  "Download the official photo ZIPs in your browser and save them locally:",
  "  SP: https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_SP.zip",
  "  BR: https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_BR.zip",
  `Then place the files in ${DEFAULT_LOCAL_PHOTO_ZIP_DIR}/ or pass --zip-file /path/to/file.zip`,
  "Run: npm run sync:photos",
].join("\n");

function parsePhotoZipUrls() {
  const raw = process.env.TSE_PHOTO_ZIP_URLS?.trim();
  if (!raw) return DEFAULT_PHOTO_ZIP_URLS;
  return raw.split(",").map((url) => url.trim()).filter(Boolean);
}

export function sqFromArchiveEntry(name: string) {
  const base = name.split("/").pop() ?? name;
  const match = base.match(/^(\d+)\.(jpe?g|png)$/i);
  return match?.[1] ?? null;
}

function contentTypeForArchiveEntry(name: string) {
  return name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

function ufFromPhotoZipUrl(url: string) {
  const match = url.match(/foto_cand\d+_([A-Z]{2})(?:_div)?\.zip/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function urlsForUfs(neededUfs: Set<string>) {
  const configured = parsePhotoZipUrls();
  if (!neededUfs.size) return configured;

  const prioritized = configured.filter((url) => {
    const uf = ufFromPhotoZipUrl(url);
    return !uf || neededUfs.has(uf);
  });
  return prioritized.length ? prioritized : configured;
}

function extractPhotosFromZip(
  zipBytes: Uint8Array,
  neededSqCandidates: Set<string>,
  archive: Map<string, TsePhotoAsset>,
) {
  const extracted = unzipSync(zipBytes, {
    filter: (file) => {
      const sq = sqFromArchiveEntry(file.name);
      return sq !== null && neededSqCandidates.has(sq) && !archive.has(sq);
    },
  });

  let loadedPhotoCount = 0;
  for (const [name, bytes] of Object.entries(extracted)) {
    const sq = sqFromArchiveEntry(name);
    if (!sq || archive.has(sq)) continue;
    archive.set(sq, {
      bytes,
      contentType: contentTypeForArchiveEntry(name),
    });
    loadedPhotoCount += 1;
  }
  return loadedPhotoCount;
}

export function discoverLocalPhotoZipPaths(explicitPaths: string[] = []) {
  if (explicitPaths.length) return explicitPaths;

  const fromEnv = process.env.TSE_PHOTO_ZIP_FILES?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) ?? [];
  if (fromEnv.length) return fromEnv;

  const directory = process.env.TSE_PHOTO_ZIP_DIR?.trim() || DEFAULT_LOCAL_PHOTO_ZIP_DIR;
  return DEFAULT_LOCAL_PHOTO_ZIP_NAMES
    .map((name) => path.join(directory, name))
    .filter((filePath) => existsSync(filePath));
}

export async function loadTsePhotoArchiveFromLocalFiles(
  filePaths: string[],
  neededSqCandidates: Iterable<string>,
): Promise<TsePhotoArchiveLoadResult> {
  const sqSet = new Set(neededSqCandidates);
  const archive = new Map<string, TsePhotoAsset>();
  const errors: string[] = [];
  let loadedZipCount = 0;

  for (const filePath of filePaths) {
    try {
      const zipBytes = new Uint8Array(await readFile(filePath));
      const loadedFromZip = extractPhotosFromZip(zipBytes, sqSet, archive);
      if (loadedFromZip > 0) {
        loadedZipCount += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${filePath}: ${message.slice(0, 160)}`);
    }
  }

  return {
    archive,
    loadedZipCount,
    loadedPhotoCount: archive.size,
    errors,
    localZipPaths: filePaths,
  };
}

async function downloadPhotoZip(url: string) {
  const response = await fetchTse(url, TSE_PHOTO_ZIP_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function loadTsePhotoArchive(
  neededSqCandidates: Iterable<string>,
  neededUfs: Iterable<string>,
): Promise<TsePhotoArchiveLoadResult> {
  const sqSet = new Set(neededSqCandidates);
  const ufSet = new Set(Array.from(neededUfs, (uf) => (uf === "BRASIL" ? "BR" : uf)));
  const archive = new Map<string, TsePhotoAsset>();
  const errors: string[] = [];
  let loadedZipCount = 0;

  for (const url of urlsForUfs(ufSet)) {
    if (archive.size >= sqSet.size) break;

    try {
      const zipBytes = await downloadPhotoZip(url);
      const loadedFromZip = extractPhotosFromZip(zipBytes, sqSet, archive);
      if (loadedFromZip > 0) {
        loadedZipCount += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message.slice(0, 180));
    }
  }

  return {
    archive,
    loadedZipCount,
    loadedPhotoCount: archive.size,
    errors,
    localZipPaths: [],
  };
}
