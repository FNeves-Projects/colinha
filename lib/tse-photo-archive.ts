import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
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

const PHOTO_ZIP_URLS_BY_UF = {
  SP: [
    "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_SP.zip",
    "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_SP_div.zip",
    "https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_SP.zip",
    "https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_SP_div.zip",
  ],
  BR: [
    "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_BR.zip",
    "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_BR_div.zip",
    "https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_BR.zip",
    "https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_BR_div.zip",
  ],
} as const;

const DEFAULT_PHOTO_ZIP_URLS = [
  ...PHOTO_ZIP_URLS_BY_UF.SP,
  ...PHOTO_ZIP_URLS_BY_UF.BR,
];

export const TSE_PHOTO_DATASET_URL = "https://dadosabertos.tse.jus.br/dataset/candidatos-2026";

export const LOCAL_PHOTO_ZIP_INSTRUCTIONS = [
  "Automatic download failed. Download photo ZIPs in your browser:",
  `  ${TSE_PHOTO_DATASET_URL}`,
  '  Required: "SP - Fotos de candidatos"',
  '  Optional: "BR - Fotos de candidatos" (president)',
  `  Save under ${DEFAULT_LOCAL_PHOTO_ZIP_DIR}/ and run npm run sync:photos again.`,
].join("\n");

export type EnsurePhotoZipOptions = {
  directory?: string;
  ufs?: Array<keyof typeof PHOTO_ZIP_URLS_BY_UF>;
  forceDownload?: boolean;
  onProgress?: (message: string) => void;
};

export type EnsurePhotoZipResult = {
  zipPaths: string[];
  downloaded: string[];
  reused: string[];
  errors: string[];
};

function photoZipCachePath(directory: string, uf: keyof typeof PHOTO_ZIP_URLS_BY_UF) {
  return path.join(directory, `foto_cand2026_${uf}.zip`);
}

function formatByteSize(size: number) {
  if (size >= 1024 * 1024) return `${Math.round(size / 1024 / 1024)} MB`;
  return `${Math.round(size / 1024)} KB`;
}

function isUsablePhotoZip(filePath: string) {
  if (!existsSync(filePath)) return false;
  try {
    return statSync(filePath).size > 10_000;
  } catch {
    return false;
  }
}

async function downloadPhotoZipToFile(url: string, destination: string) {
  const response = await fetchTse(url, TSE_PHOTO_ZIP_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 10_000) {
    throw new Error(`too small (${bytes.length} bytes) ${url}`);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("text/html")) {
    throw new Error(`html response ${url}`);
  }

  await writeFile(destination, bytes);
  return bytes.length;
}

export async function ensureTsePhotoZipFiles(
  options: EnsurePhotoZipOptions = {},
): Promise<EnsurePhotoZipResult> {
  const log = options.onProgress ?? (() => undefined);
  const directory = path.resolve(
    options.directory ?? (process.env.TSE_PHOTO_ZIP_DIR?.trim() || DEFAULT_LOCAL_PHOTO_ZIP_DIR),
  );
  const ufs = options.ufs ?? ["SP", "BR"];
  const forceDownload = options.forceDownload ?? false;

  await mkdir(directory, { recursive: true });

  const zipPaths: string[] = [];
  const downloaded: string[] = [];
  const reused: string[] = [];
  const errors: string[] = [];

  for (const uf of ufs) {
    const destination = photoZipCachePath(directory, uf);
    const urls = parsePhotoZipUrlsByUf(uf);

    if (!forceDownload && isUsablePhotoZip(destination)) {
      log(`Using cached ${uf} ZIP: ${destination}`);
      zipPaths.push(destination);
      reused.push(destination);
      continue;
    }

    let saved = false;
    for (const url of urls) {
      try {
        log(`Downloading ${uf} photos from ${url} ...`);
        const size = await downloadPhotoZipToFile(url, destination);
        log(`Saved ${uf} ZIP (${formatByteSize(size)}): ${destination}`);
        zipPaths.push(destination);
        downloaded.push(destination);
        saved = true;
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${uf}: ${message.slice(0, 180)}`);
      }
    }

    if (!saved && isUsablePhotoZip(destination)) {
      log(`Download failed for ${uf}; reusing cached ZIP: ${destination}`);
      zipPaths.push(destination);
      reused.push(destination);
    } else if (!saved && uf === "BR") {
      log(`BR photo ZIP unavailable (president photos optional).`);
    } else if (!saved) {
      log(`Failed to download ${uf} photo ZIP.`);
    }
  }

  return { zipPaths, downloaded, reused, errors };
}

function parsePhotoZipUrlsByUf(uf: keyof typeof PHOTO_ZIP_URLS_BY_UF) {
  const raw = process.env.TSE_PHOTO_ZIP_URLS?.trim();
  if (!raw) return [...PHOTO_ZIP_URLS_BY_UF[uf]];

  const configured = raw.split(",").map((url) => url.trim()).filter(Boolean);
  const forUf = configured.filter((url) => {
    const match = ufFromPhotoZipUrl(url);
    return match === uf;
  });
  return forUf.length ? forUf : [...PHOTO_ZIP_URLS_BY_UF[uf]];
}

function parsePhotoZipUrls() {
  const raw = process.env.TSE_PHOTO_ZIP_URLS?.trim();
  if (!raw) return DEFAULT_PHOTO_ZIP_URLS;
  return raw.split(",").map((url) => url.trim()).filter(Boolean);
}

export function resolveLocalPath(input: string) {
  const trimmed = input.trim();
  if (trimmed.startsWith("~/")) {
    return path.resolve(os.homedir(), trimmed.slice(2));
  }
  if (trimmed === "~") {
    return os.homedir();
  }
  return path.resolve(trimmed);
}

export function resolveLocalPhotoZipPaths(filePaths: string[]) {
  return filePaths.map(resolveLocalPath);
}

export function validateLocalPhotoZipPaths(filePaths: string[]) {
  const resolved = resolveLocalPhotoZipPaths(filePaths);
  const existing = resolved.filter((filePath) => existsSync(filePath));
  const missing = resolved.filter((filePath) => !existsSync(filePath));

  if (!existing.length) {
    throw new Error([
      "ZIP file(s) not found:",
      ...missing.map((filePath) => `  - ${filePath}`),
      "",
      LOCAL_PHOTO_ZIP_INSTRUCTIONS,
    ].join("\n"));
  }

  return { existing, missing };
}

export function sqFromArchiveEntry(name: string) {
  const base = name.split("/").pop() ?? name;

  // Official TSE layout: FSP250002530169_div.jpg / FBR280002551932_div.jpg
  const tseOfficial = base.match(/^F[A-Z]{2}(\d{10,15})(?:_div)?\.(jpe?g|png)$/i);
  if (tseOfficial) return tseOfficial[1];

  const direct = base.match(/^(\d{10,15})(?:_div)?\.(jpe?g|png)$/i);
  if (direct) return direct[1];

  const prefixed = base.match(/(?:^|[_-])(\d{10,15})(?:_div)?\.(jpe?g|png)$/i);
  if (prefixed) return prefixed[1];

  const digitsOnly = base.match(/^(\d{10,15})$/i);
  if (digitsOnly) return digitsOnly[1];

  return null;
}

export function inspectLocalPhotoZip(filePath: string, sampleSize = 8) {
  const resolved = resolveLocalPath(filePath);
  if (!existsSync(resolved)) {
    throw new Error(`ZIP not found: ${resolved}`);
  }

  const zipBytes = new Uint8Array(readFileSync(resolved));
  const entries = unzipSync(zipBytes);
  const imageEntries = Object.keys(entries).filter((name) => /\.(jpe?g|png)$/i.test(name));
  const sampleNames = imageEntries.slice(0, sampleSize);
  const sampleSq = sampleNames.map((name) => sqFromArchiveEntry(name)).filter(Boolean);

  return {
    resolvedPath: resolved,
    totalEntries: Object.keys(entries).length,
    imageEntries: imageEntries.length,
    sampleNames,
    sampleSq,
  };
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
  if (explicitPaths.length) {
    return validateLocalPhotoZipPaths(explicitPaths).existing;
  }

  const fromEnv = process.env.TSE_PHOTO_ZIP_FILES?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) ?? [];
  if (fromEnv.length) {
    return validateLocalPhotoZipPaths(fromEnv).existing;
  }

  const directory = path.resolve(process.env.TSE_PHOTO_ZIP_DIR?.trim() || DEFAULT_LOCAL_PHOTO_ZIP_DIR);
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
