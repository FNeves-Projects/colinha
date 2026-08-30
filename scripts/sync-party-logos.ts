import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = path.join(process.cwd(), "public/party-logos");
const CAMARA_PARTIES_URL = "https://dadosabertos.camara.leg.br/api/v2/partidos?itens=100&ordem=ASC&ordenarPor=sigla";

type CamaraParty = {
  id: number;
  sigla: string;
  uri: string;
};

type CamaraPartyDetail = {
  sigla: string;
  urlLogo: string | null;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Failed ${url}: ${response.status}`);
  return response.json() as Promise<T>;
}

async function downloadLogo(sigla: string, url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Logo download failed for ${sigla}: ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  const extension = contentType.includes("png") ? "png" : "gif";
  const bytes = Buffer.from(await response.arrayBuffer());
  const fileName = `${sigla}.${extension}`;
  await writeFile(path.join(OUTPUT_DIR, fileName), bytes);
  return fileName;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const list = await fetchJson<{ dados: CamaraParty[] }>(CAMARA_PARTIES_URL);
  const manifest: Record<string, string> = {};
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
        skipped += 1;
        continue;
      }

      const fileName = await downloadLogo(sigla, logoUrl);
      manifest[sigla] = `/party-logos/${fileName}`;
      saved += 1;
      process.stdout.write(`Saved ${sigla}\n`);
    } catch (error) {
      skipped += 1;
      process.stderr.write(`${sigla}: ${(error as Error).message}\n`);
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
