import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = path.join(process.cwd(), "public/party-logos");
const CAMARA_PARTIES_URL = "https://dadosabertos.camara.leg.br/api/v2/partidos?itens=100&ordem=ASC&ordenarPor=sigla";
const COLINHA_LOGO_BASE = "https://assets.colinha.ai/partidos";

const COLINHA_SLUG_ALIASES: Record<string, string> = {
  PODE: "pode",
  PODEM: "pode",
  UNIAO: "uniao",
  "UNIÃO": "uniao",
  PCDOB: "pc-do-b",
  PC_DO_B: "pc-do-b",
};

type CamaraParty = {
  id: number;
  sigla: string;
  uri: string;
};

type CamaraPartyDetail = {
  sigla: string;
  urlLogo: string | null;
};

function colinhaSlug(sigla: string) {
  const key = sigla.trim().toUpperCase();
  const aliased = COLINHA_SLUG_ALIASES[key] ?? key;
  return aliased
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Failed ${url}: ${response.status}`);
  return response.json() as Promise<T>;
}

async function downloadLogo(sigla: string, url: string, extension?: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Logo download failed for ${sigla}: ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  const resolvedExtension =
    extension ??
    (contentType.includes("png") ? "png" : contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "gif");
  const bytes = Buffer.from(await response.arrayBuffer());
  const fileName = `${sigla}.${resolvedExtension}`;
  await writeFile(path.join(OUTPUT_DIR, fileName), bytes);
  return fileName;
}

async function downloadColinhaLogo(sigla: string) {
  const slug = colinhaSlug(sigla);
  const url = `${COLINHA_LOGO_BASE}/${slug}/logo/sm.jpg`;
  return downloadLogo(sigla, url, "jpg");
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const list = await fetchJson<{ dados: CamaraParty[] }>(CAMARA_PARTIES_URL);
  const manifest: Record<string, string> = {};
  const pendingColinha: string[] = [];
  let saved = 0;
  let skipped = 0;

  for (const party of list.dados) {
    const sigla = party.sigla.trim().toUpperCase();
    if (!sigla) continue;

    try {
      const detail = await fetchJson<{ dados: CamaraPartyDetail }>(
        `https://dadosabertos.camara.leg.br/api/v2/partidos/${party.id}`,
      );
      const logoUrl = detail.dados.urlLogo?.trim();
      if (!logoUrl) {
        pendingColinha.push(sigla);
        continue;
      }

      const fileName = await downloadLogo(sigla, logoUrl);
      manifest[sigla] = `/party-logos/${fileName}`;
      saved += 1;
      process.stdout.write(`Saved ${sigla}\n`);
    } catch (error) {
      pendingColinha.push(sigla);
      process.stderr.write(`${sigla}: ${(error as Error).message}\n`);
    }
  }

  for (const sigla of pendingColinha) {
    if (manifest[sigla]) continue;
    try {
      const fileName = await downloadColinhaLogo(sigla);
      manifest[sigla] = `/party-logos/${fileName}`;
      saved += 1;
      process.stdout.write(`Saved ${sigla} (colinha)\n`);
    } catch (error) {
      skipped += 1;
      process.stderr.write(`${sigla} fallback: ${(error as Error).message}\n`);
    }
  }

  const manifestPath = path.join(process.cwd(), "lib/party-logos.generated.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`Done. Saved ${saved}, skipped ${skipped}.\n`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
