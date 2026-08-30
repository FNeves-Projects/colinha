import { parse } from "csv-parse/sync";
import { unzipSync } from "fflate";
import { CANDIDATE_PHOTO_PUBLIC_PATH, candidatePhotoPublicUrl } from "./candidate-photo-urls";
import { syncCandidateDetails } from "./candidate-detail-sync";
import { syncCandidatePhotos } from "./candidate-photo-sync";
import { getSql } from "./db";
import { normalizeSocialLink } from "./social-links";
import {
  TSE_CANDIDATE_PHOTO_BASE,
  TSE_ELECTION_ID_2026,
  tseCandidateUrl,
} from "./tse-urls";

type CsvRow = Record<string, string>;

type DivulgaCandidate = {
  id?: string | number;
  sqCandidato?: string | number;
  nomeUrna?: string;
  numero?: string | number;
  numeroCandidato?: string | number;
  nomeCompleto?: string;
  nomeCandidato?: string;
  siglaPartido?: string;
  numeroPartido?: string | number;
  codigoCargo?: string | number;
  descricaoCargo?: string;
  descricaoSituacao?: string;
  situacaoCandidato?: string;
  descricaoSituacaoCandidato?: string;
  descricaoTotalizacao?: string;
  dataDeNascimento?: string | number;
  grauInstrucao?: string;
  ocupacao?: string;
  fotoUrl?: string;
  descricaoSexo?: string;
  descricaoCorRaca?: string;
  descricaoEstadoCivil?: string;
  partido?: { sigla?: string; numero?: string | number };
  cargo?: { codigo?: string | number; nome?: string };
  bens?: Array<{
    descricao?: string;
    descricaoDeTipoDeBem?: string;
    valor?: string | number;
  }>;
  sites?: Array<string | { url?: string }>;
};

type NormalizedCandidate = {
  sq_candidate: string;
  election_year: number;
  uf: string;
  office_code: number;
  office_name: string;
  ballot_number: string;
  ballot_name: string;
  full_name: string;
  party_acronym: string | null;
  party_number: string | null;
  status: string | null;
  status_detail: string | null;
  birth_date: string | null;
  occupation: string | null;
  education: string | null;
  gender: string | null;
  race: string | null;
  marital_status: string | null;
  photo_url?: string | null;
  tse_url?: string | null;
  source_updated_at: string;
};

const DEFAULT_CANDIDATE_URLS = [
  "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip",
];
const DEFAULT_SOCIAL_URL =
  "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/rede_social_candidato_2026.zip";
const DEFAULT_ASSETS_URL =
  "https://cdn.tse.jus.br/estatistica/sead/odsele/bem_candidato/bem_candidato_2026.zip";

const DIVULGA_BASE = "https://divulgacandcontas.tse.jus.br/divulga";
const DIVULGA_ELECTION_ID = TSE_ELECTION_ID_2026;
const MIRROR_COMMIT = "e81e41d02a14d84c26b84bcb3c1ed72b58697616";
const MIRROR_BASE = `https://raw.githubusercontent.com/leofn/tse-candidatos-2026/${MIRROR_COMMIT}/dados`;
const MIRROR_CANDIDATE_URLS = [
  `${MIRROR_BASE}/consulta_cand_2026_SP.csv`,
  `${MIRROR_BASE}/consulta_cand_2026_BR.csv`,
];
const MIRROR_SOCIAL_URLS = [
  `${MIRROR_BASE}/rede_social_candidato_2026_SP.csv`,
  `${MIRROR_BASE}/rede_social_candidato_2026_BR.csv`,
];
const MIRROR_ASSET_URLS = [
  `${MIRROR_BASE}/bem_candidato_2026_SP.csv`,
  `${MIRROR_BASE}/bem_candidato_2026_BR.csv`,
];
const DIVULGA_TARGETS = [
  { uf: "SP", officeCode: 3, officeName: "Governador" },
  { uf: "SP", officeCode: 4, officeName: "Vice-governador" },
  { uf: "SP", officeCode: 5, officeName: "Senador" },
  { uf: "SP", officeCode: 9, officeName: "1o Suplente Senador" },
  { uf: "SP", officeCode: 10, officeName: "2o Suplente Senador" },
  { uf: "SP", officeCode: 6, officeName: "Deputado Federal" },
  { uf: "SP", officeCode: 7, officeName: "Deputado Estadual" },
  { uf: "BR", officeCode: 1, officeName: "Presidente" },
  { uf: "BR", officeCode: 2, officeName: "Vice-presidente" },
] as const;

function isRelevantCsv(name: string) {
  const normalized = name.toLowerCase();
  if (!normalized.endsWith(".csv")) return false;

  // The packages include one CSV per state and one consolidated BRASIL file.
  // Importing only SP and BR avoids duplicated candidates from the full file.
  return /_(sp|br)\.csv$/.test(normalized);
}

async function downloadCsvRows(url: string): Promise<CsvRow[]> {
  const response = await fetch(url, {
    headers: { "User-Agent": "ColinhaDigital/1.0 (tse-open-data)" },
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`TSE returned ${response.status} for ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (url.toLowerCase().endsWith(".csv")) {
    const text = new TextDecoder("windows-1252").decode(bytes);
    return parse(text, {
      bom: true,
      columns: true,
      delimiter: ";",
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    }) as CsvRow[];
  }

  const zip = unzipSync(bytes, {
    filter: (file) => isRelevantCsv(file.name),
  });
  const files = Object.entries(zip);
  if (!files.length) throw new Error(`CSV de SP/BR nao encontrado em ${url}`);

  return files.flatMap<CsvRow>(([, bytes]) => {
    const text = new TextDecoder("windows-1252").decode(bytes);
    return parse(text, {
      bom: true,
      columns: true,
      delimiter: ";",
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    }) as CsvRow[];
  });
}

function nullable(value?: string) {
  const clean = value?.trim();
  return clean && !["#NULO#", "#NE", "-1"].includes(clean) ? clean : null;
}

function isoDate(value?: string) {
  const clean = nullable(value);
  if (!clean) return null;
  const [day, month, year] = clean.split("/");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function divulgaDate(value?: string | number) {
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  if (!value) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return isoDate(value);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function csvSourceTimestamp(row: CsvRow) {
  const date = isoDate(row.DT_GERACAO);
  if (!date) return new Date().toISOString();
  const time = /^\d{2}:\d{2}:\d{2}$/.test(row.HH_GERACAO ?? "")
    ? row.HH_GERACAO
    : "00:00:00";
  return new Date(`${date}T${time}-03:00`).toISOString();
}

function safeUrl(value?: string) {
  return normalizeSocialLink(value)?.url
    ?? (() => {
      const clean = nullable(value);
      if (!clean) return null;
      try {
        const withoutProtocols = clean.replace(/^(https?:\/\/)+/i, "");
        const url = new URL(`https://${withoutProtocols}`);
        if (url.protocol !== "https:" && url.protocol !== "http:") return null;
        url.protocol = "https:";
        return url.toString();
      } catch {
        return null;
      }
    })();
}

function safeTseUrl(value?: string) {
  const clean = nullable(value);
  if (!clean) return null;
  if (clean.startsWith("/")) return new URL(clean, "https://divulgacandcontas.tse.jus.br").toString();
  return safeUrl(clean);
}

async function persistCandidates(normalized: NormalizedCandidate[]) {
  const sql = getSql();
  for (let index = 0; index < normalized.length; index += 500) {
    const batch = normalized.slice(index, index + 500);
    await sql.query(
      `INSERT INTO candidates (
        sq_candidate, election_year, uf, office_code, office_name, ballot_number,
        ballot_name, full_name, party_acronym, party_number, status, status_detail,
        birth_date, occupation, education, gender, race, marital_status, photo_url,
        tse_url, source_updated_at
      )
      SELECT x.sq_candidate, x.election_year, x.uf, x.office_code, x.office_name,
        x.ballot_number, x.ballot_name, x.full_name, x.party_acronym, x.party_number,
        x.status, x.status_detail, x.birth_date::date, x.occupation, x.education,
        x.gender, x.race, x.marital_status, x.photo_url, x.tse_url,
        x.source_updated_at::timestamptz
      FROM jsonb_to_recordset($1::jsonb) AS x(
        sq_candidate text, election_year smallint, uf text, office_code int, office_name text,
        ballot_number text, ballot_name text, full_name text, party_acronym text,
        party_number text, status text, status_detail text, birth_date text,
        occupation text, education text, gender text, race text, marital_status text,
        photo_url text, tse_url text, source_updated_at text
      )
      ON CONFLICT (sq_candidate) DO UPDATE SET
        election_year = EXCLUDED.election_year, uf = EXCLUDED.uf,
        office_code = EXCLUDED.office_code, office_name = EXCLUDED.office_name,
        ballot_number = EXCLUDED.ballot_number, ballot_name = EXCLUDED.ballot_name,
        full_name = EXCLUDED.full_name, party_acronym = EXCLUDED.party_acronym,
        party_number = EXCLUDED.party_number, status = EXCLUDED.status,
        status_detail = EXCLUDED.status_detail, birth_date = EXCLUDED.birth_date,
        occupation = EXCLUDED.occupation, education = EXCLUDED.education,
        gender = EXCLUDED.gender, race = EXCLUDED.race,
        marital_status = EXCLUDED.marital_status,
        photo_url = CASE
          WHEN candidates.photo_url LIKE '/candidate-photos/%'
            OR candidates.photo_url LIKE '%public.blob.vercel-storage.com/%' THEN candidates.photo_url
          ELSE COALESCE(EXCLUDED.photo_url, candidates.photo_url)
        END,
        tse_url = COALESCE(EXCLUDED.tse_url, candidates.tse_url),
        source = 'TSE', source_updated_at = EXCLUDED.source_updated_at,
        updated_at = now()`,
      [JSON.stringify(batch)],
    );
  }
}

async function backfillCandidatePhotoUrls() {
  const sql = getSql();
  const rows = await sql.query(
    `UPDATE candidates
        SET photo_url = $1 || '/' || sq_candidate || '.jpg',
            updated_at = now()
      WHERE election_year = 2026
        AND uf IN ('SP', 'BR')
        AND source = 'TSE'
        AND sq_candidate ~ '^[0-9]+$'
        AND (
          photo_url IS NULL
          OR photo_url = ''
          OR photo_url LIKE '/assets/%'
          OR photo_url LIKE $2 || '/%'
          OR photo_url LIKE '%public.blob.vercel-storage.com/%'
          OR photo_url NOT LIKE $1 || '/%'
        )
      RETURNING id::text`,
    [CANDIDATE_PHOTO_PUBLIC_PATH, TSE_CANDIDATE_PHOTO_BASE],
  ) as Array<{ id: string }>;
  return rows.length;
}

async function upsertCandidates(rows: CsvRow[]) {
  const sql = getSql();
  const normalized: NormalizedCandidate[] = rows
    .filter((row) => ["SP", "BR", "BRASIL"].includes(row.SG_UF))
    .map((row) => ({
      sq_candidate: row.SQ_CANDIDATO,
      election_year: Number(row.ANO_ELEICAO || 2026),
      uf: row.SG_UF === "BRASIL" ? "BR" : row.SG_UF,
      office_code: Number(row.CD_CARGO),
      office_name: row.DS_CARGO,
      ballot_number: row.NR_CANDIDATO,
      ballot_name: row.NM_URNA_CANDIDATO,
      full_name: row.NM_CANDIDATO,
      party_acronym: nullable(row.SG_PARTIDO),
      party_number: nullable(row.NR_PARTIDO),
      status: nullable(row.DS_SITUACAO_CANDIDATURA),
      status_detail: nullable(row.DS_DETALHE_SITUACAO_CAND),
      birth_date: isoDate(row.DT_NASCIMENTO),
      occupation: nullable(row.DS_OCUPACAO),
      education: nullable(row.DS_GRAU_INSTRUCAO),
      gender: nullable(row.DS_GENERO),
      race: nullable(row.DS_COR_RACA),
      marital_status: nullable(row.DS_ESTADO_CIVIL),
      photo_url: candidatePhotoPublicUrl(row.SQ_CANDIDATO),
      tse_url: tseCandidateUrl(row.SG_UF === "BRASIL" ? "BR" : row.SG_UF, row.SQ_CANDIDATO),
      source_updated_at: csvSourceTimestamp(row),
    }))
    .filter((row) => row.sq_candidate && row.ballot_number && row.ballot_name);

  const preservedPhotos = await sql.query(
    `SELECT sq_candidate, photo_url
       FROM candidates
      WHERE election_year = 2026
        AND uf IN ('SP', 'BR')
        AND (
          photo_url LIKE '/candidate-photos/%'
          OR photo_url LIKE '%public.blob.vercel-storage.com/%'
        )`,
  ) as Array<{ sq_candidate: string; photo_url: string }>;

  // The CSV is a complete SP + BR snapshot. Delete only previous TSE rows so
  // withdrawn candidates and fallback duplicates do not remain in the database.
  await sql.query(
    `DELETE FROM candidates
      WHERE election_year = 2026 AND uf IN ('SP', 'BR') AND source = 'TSE'`,
  );
  await persistCandidates(normalized);
  if (preservedPhotos.length) {
    await sql.query(
      `UPDATE candidates AS c
          SET photo_url = x.photo_url,
              updated_at = now()
         FROM jsonb_to_recordset($1::jsonb) AS x(sq_candidate text, photo_url text)
        WHERE c.sq_candidate = x.sq_candidate`,
      [JSON.stringify(preservedPhotos)],
    );
  }
  return normalized.length;
}

async function downloadDivulgaCandidates(target: (typeof DIVULGA_TARGETS)[number]) {
  const url = `${DIVULGA_BASE}/rest/v1/candidatura/listar/2026/${target.uf}/${DIVULGA_ELECTION_ID}/${target.officeCode}/candidatos`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "ColinhaDigital/1.0" },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`DivulgaCand returned ${response.status} for ${url}`);
  const payload = await response.json() as { candidatos?: DivulgaCandidate[] } | DivulgaCandidate[];
  const candidates = Array.isArray(payload) ? payload : payload.candidatos;
  if (!Array.isArray(candidates)) throw new Error(`Invalid candidate list from ${url}`);
  return candidates;
}

type DivulgaCandidatePatch = {
  sq_candidate: string;
  status: string | null;
  status_detail: string | null;
  occupation: string | null;
  education: string | null;
  gender: string | null;
  race: string | null;
  marital_status: string | null;
  birth_date: string | null;
};

function divulgaCandidatePatch(row: DivulgaCandidate): DivulgaCandidatePatch | null {
  const sqCandidate = String(row.id ?? row.sqCandidato ?? "").trim();
  if (!sqCandidate) return null;

  return {
    sq_candidate: sqCandidate,
    status: row.descricaoSituacao?.trim() || row.situacaoCandidato?.trim() || null,
    status_detail: row.descricaoSituacaoCandidato?.trim() || row.descricaoTotalizacao?.trim() || null,
    occupation: row.ocupacao?.trim() || null,
    education: row.grauInstrucao?.trim() || null,
    gender: row.descricaoSexo?.trim() || null,
    race: row.descricaoCorRaca?.trim() || null,
    marital_status: row.descricaoEstadoCivil?.trim() || null,
    birth_date: divulgaDate(row.dataDeNascimento),
  };
}

/** Fill live DivulgaCand fields missing from TSE Open Data CSV (#NE placeholders). */
export async function enrichCandidatesFromDivulgaCand() {
  const sql = getSql();
  const patches: DivulgaCandidatePatch[] = [];

  for (const target of DIVULGA_TARGETS) {
    const rows = await downloadDivulgaCandidates(target);
    for (const row of rows) {
      const patch = divulgaCandidatePatch(row);
      if (patch) patches.push(patch);
    }
  }

  for (let index = 0; index < patches.length; index += 500) {
    const batch = patches.slice(index, index + 500);
    await sql.query(
      `UPDATE candidates AS c
          SET status = COALESCE(x.status, c.status),
              status_detail = COALESCE(x.status_detail, c.status_detail),
              occupation = COALESCE(c.occupation, x.occupation),
              education = COALESCE(c.education, x.education),
              gender = COALESCE(c.gender, x.gender),
              race = COALESCE(c.race, x.race),
              marital_status = COALESCE(c.marital_status, x.marital_status),
              birth_date = COALESCE(c.birth_date, x.birth_date::date),
              updated_at = now()
         FROM jsonb_to_recordset($1::jsonb) AS x(
           sq_candidate text,
           status text,
           status_detail text,
           occupation text,
           education text,
           gender text,
           race text,
           marital_status text,
           birth_date text
         )
        WHERE c.sq_candidate = x.sq_candidate
          AND c.election_year = 2026
          AND c.uf IN ('SP', 'BR')`,
      [JSON.stringify(batch)],
    );
  }

  return patches.length;
}

async function syncDivulgaCand() {
  const sql = getSql();
  let candidateCount = 0;
  let socialCount = 0;
  let assetCount = 0;

  for (const target of DIVULGA_TARGETS) {
    const rows = await downloadDivulgaCandidates(target);
    const now = new Date().toISOString();
    const normalized: NormalizedCandidate[] = rows.flatMap((row) => {
      const id = String(row.id ?? row.sqCandidato ?? "").trim();
      const number = String(row.numero ?? row.numeroCandidato ?? "").trim();
      const ballotName = row.nomeUrna?.trim();
      if (!id || !number || !ballotName) return [];
      return [{
        sq_candidate: id,
        election_year: 2026,
        uf: target.uf,
        office_code: Number(row.cargo?.codigo ?? row.codigoCargo ?? target.officeCode),
        office_name: row.cargo?.nome?.trim() || row.descricaoCargo?.trim() || target.officeName,
        ballot_number: number,
        ballot_name: ballotName,
        full_name: row.nomeCompleto?.trim() || row.nomeCandidato?.trim() || ballotName,
        party_acronym: row.partido?.sigla?.trim() || row.siglaPartido?.trim() || null,
        party_number: row.partido?.numero == null
          ? row.numeroPartido == null ? null : String(row.numeroPartido)
          : String(row.partido.numero),
        status: row.descricaoSituacao?.trim() || row.situacaoCandidato?.trim() || null,
        status_detail: row.descricaoSituacaoCandidato?.trim() || row.descricaoTotalizacao?.trim() || null,
        birth_date: divulgaDate(row.dataDeNascimento),
        occupation: row.ocupacao?.trim() || null,
        education: row.grauInstrucao?.trim() || null,
        gender: row.descricaoSexo?.trim() || null,
        race: row.descricaoCorRaca?.trim() || null,
        marital_status: row.descricaoEstadoCivil?.trim() || null,
        photo_url: candidatePhotoPublicUrl(id),
        tse_url: tseCandidateUrl(target.uf, id),
        source_updated_at: now,
      }];
    });
    await persistCandidates(normalized);
    candidateCount += normalized.length;

    const socialRows = rows.flatMap((row) => {
      const sqCandidate = String(row.id ?? row.sqCandidato ?? "").trim();
      if (!sqCandidate || !Array.isArray(row.sites)) return [];
      return row.sites.flatMap((site) => {
        const parsed = normalizeSocialLink(typeof site === "string" ? site : site.url);
        return parsed ? [{ sq_candidate: sqCandidate, platform: parsed.platform, url: parsed.url }] : [];
      });
    });
    if (rows.some((row) => Array.isArray(row.sites))) {
      await sql.query(
        `DELETE FROM candidate_social_links
          WHERE candidate_id IN (
            SELECT c.id FROM candidates c
            JOIN jsonb_array_elements_text($1::jsonb) ids(value)
              ON c.sq_candidate = ids.value
          )`,
        [JSON.stringify(normalized.map((row) => row.sq_candidate))],
      );
      for (let index = 0; index < socialRows.length; index += 500) {
        await sql.query(
          `INSERT INTO candidate_social_links (candidate_id, platform, url)
           SELECT c.id, x.platform, x.url
             FROM jsonb_to_recordset($1::jsonb) AS x(sq_candidate text, platform text, url text)
             JOIN candidates c ON c.sq_candidate = x.sq_candidate
           ON CONFLICT (candidate_id, url) DO UPDATE SET platform = EXCLUDED.platform`,
          [JSON.stringify(socialRows.slice(index, index + 500))],
        );
      }
      socialCount += socialRows.length;
    }

    const assetRows = rows.flatMap((row) => {
      const sqCandidate = String(row.id ?? row.sqCandidato ?? "").trim();
      if (!sqCandidate || !Array.isArray(row.bens)) return [];
      return row.bens.map((asset) => {
        const value = Number(asset.valor ?? 0);
        return {
          sq_candidate: sqCandidate,
          asset_type: asset.descricaoDeTipoDeBem?.trim() || "Bem declarado",
          description: asset.descricao?.trim() || "Sem descricao",
          value: Number.isFinite(value) ? value : 0,
        };
      });
    });
    if (rows.some((row) => Array.isArray(row.bens))) {
      await sql.query(
        `DELETE FROM declared_assets
          WHERE candidate_id IN (
            SELECT c.id FROM candidates c
            JOIN jsonb_array_elements_text($1::jsonb) ids(value)
              ON c.sq_candidate = ids.value
          )`,
        [JSON.stringify(normalized.map((row) => row.sq_candidate))],
      );
      for (let index = 0; index < assetRows.length; index += 500) {
        await sql.query(
          `INSERT INTO declared_assets (candidate_id, asset_type, description, value)
           SELECT c.id, x.asset_type, x.description, x.value
             FROM jsonb_to_recordset($1::jsonb) AS x(
               sq_candidate text, asset_type text, description text, value numeric
             )
             JOIN candidates c ON c.sq_candidate = x.sq_candidate`,
          [JSON.stringify(assetRows.slice(index, index + 500))],
        );
      }
      assetCount += assetRows.length;
    }
  }
  return { candidateCount, socialCount, assetCount };
}

async function getStoredSnapshot() {
  const sql = getSql();
  const rows = await sql.query(
    `SELECT
       max(source_updated_at)::text AS updated_at,
       count(*) FILTER (WHERE source = 'TSE')::int AS candidate_count,
       (SELECT count(*)::int FROM candidate_social_links s
         JOIN candidates c ON c.id = s.candidate_id
        WHERE c.election_year = 2026 AND c.uf IN ('SP', 'BR')) AS social_count,
       (SELECT count(*)::int FROM declared_assets a
         JOIN candidates c ON c.id = a.candidate_id
        WHERE c.election_year = 2026 AND c.uf IN ('SP', 'BR')) AS asset_count
     FROM candidates
     WHERE election_year = 2026 AND uf IN ('SP', 'BR')`,
  ) as Array<{
    updated_at: string | null;
    candidate_count: number;
    social_count: number;
    asset_count: number;
  }>;
  return rows[0];
}

function latestCsvTimestamp(rows: CsvRow[]) {
  return rows.reduce((latest, row) => {
    const current = csvSourceTimestamp(row);
    return current > latest ? current : latest;
  }, "");
}

async function upsertSocials(rows: CsvRow[]) {
  const sql = getSql();
  const socialRows = rows.flatMap((row) => {
    const parsed = normalizeSocialLink(row.DS_URL);
    return parsed && row.SQ_CANDIDATO
      ? [{ sq_candidate: row.SQ_CANDIDATO, platform: parsed.platform, url: parsed.url }]
      : [];
  });
  const normalized = [...new Map(
    socialRows.map((row) => [`${row.sq_candidate}\u0000${row.url}`, row]),
  ).values()];
  await sql.query(
    `DELETE FROM candidate_social_links
      WHERE candidate_id IN (SELECT id FROM candidates WHERE election_year = 2026)`,
  );
  for (let index = 0; index < normalized.length; index += 500) {
    await sql.query(
      `INSERT INTO candidate_social_links (candidate_id, platform, url)
       SELECT c.id, x.platform, x.url
         FROM jsonb_to_recordset($1::jsonb) AS x(sq_candidate text, platform text, url text)
         JOIN candidates c ON c.sq_candidate = x.sq_candidate
       ON CONFLICT (candidate_id, url) DO UPDATE SET platform = EXCLUDED.platform`,
      [JSON.stringify(normalized.slice(index, index + 500))],
    );
  }
  const counts = await sql.query(
    `SELECT count(*)::int AS count
       FROM candidate_social_links s
       JOIN candidates c ON c.id = s.candidate_id
      WHERE c.election_year = 2026 AND c.uf IN ('SP', 'BR')`,
  ) as Array<{ count: number }>;
  return counts[0]?.count ?? 0;
}

async function upsertAssets(rows: CsvRow[]) {
  const sql = getSql();
  const normalized = rows
    .map((row) => ({
      sq_candidate: row.SQ_CANDIDATO,
      asset_type: nullable(row.DS_TIPO_BEM_CANDIDATO) ?? "Bem declarado",
      description: nullable(row.DS_BEM_CANDIDATO) ?? "Sem descricao",
      value: Number((row.VR_BEM_CANDIDATO || "0").replace(/\./g, "").replace(",", ".")),
    }))
    .filter((row) => row.sq_candidate && Number.isFinite(row.value));
  await sql.query(
    `DELETE FROM declared_assets
      WHERE candidate_id IN (SELECT id FROM candidates WHERE election_year = 2026)`,
  );
  for (let index = 0; index < normalized.length; index += 500) {
    await sql.query(
      `INSERT INTO declared_assets (candidate_id, asset_type, description, value)
       SELECT c.id, x.asset_type, x.description, x.value
         FROM jsonb_to_recordset($1::jsonb) AS x(
           sq_candidate text, asset_type text, description text, value numeric
         )
         JOIN candidates c ON c.sq_candidate = x.sq_candidate`,
      [JSON.stringify(normalized.slice(index, index + 500))],
    );
  }
  const counts = await sql.query(
    `SELECT count(*)::int AS count
       FROM declared_assets a
       JOIN candidates c ON c.id = a.candidate_id
      WHERE c.election_year = 2026 AND c.uf IN ('SP', 'BR')`,
  ) as Array<{ count: number }>;
  return counts[0]?.count ?? 0;
}

export async function syncTse(options?: { skipPhotos?: boolean; skipDetails?: boolean }) {
  const sql = getSql();
  const runRows = await sql.query(
    `INSERT INTO sync_runs (source, status) VALUES ('TSE', 'running') RETURNING id::text`,
  ) as Array<{ id: string }>;
  const runId = runRows[0].id;
  try {
    let details: {
      strategy: "tse-open-data" | "divulga-cand" | "tse-mirror";
      candidateCount: number;
      socialCount: number;
      assetCount: number;
      divulgaEnrichCount?: number;
      primaryError?: string;
      secondaryError?: string;
      mirrorCommit?: string;
      mirrorSkipped?: boolean;
      photoBackfillCount?: number;
      photoSyncEnabled?: boolean;
      photoSyncLimit?: number;
      photoSyncScannedCount?: number;
      photoSyncWrittenCount?: number;
      photoSyncSkippedCount?: number;
      photoSyncFailedCount?: number;
      photoSyncArchiveZipCount?: number;
      photoSyncArchivePhotoCount?: number;
      photoSyncArchiveErrors?: string[];
      photoSyncLocalZipPaths?: string[];
      photoSyncOutputDir?: string;
      photoSyncErrors?: string[];
      photoSyncSkippedOnVercel?: boolean;
      photoSyncHint?: string;
      snapshotUpdatedAt?: string;
    };
    try {
      const candidateUrls = (process.env.TSE_CANDIDATES_URLS ?? DEFAULT_CANDIDATE_URLS.join(","))
        .split(",").map((url) => url.trim()).filter(Boolean);
      const candidateGroups = await Promise.all(candidateUrls.map(downloadCsvRows));
      const candidateCount = await upsertCandidates(candidateGroups.flat());
      const socialCount = await upsertSocials(
        await downloadCsvRows(process.env.TSE_SOCIALS_URL ?? DEFAULT_SOCIAL_URL),
      );
      const assetCount = await upsertAssets(
        await downloadCsvRows(process.env.TSE_ASSETS_URL ?? DEFAULT_ASSETS_URL),
      );
      details = { strategy: "tse-open-data", candidateCount, socialCount, assetCount };
    } catch (primaryError) {
      const primaryMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
      try {
        details = {
          strategy: "divulga-cand",
          ...(await syncDivulgaCand()),
          primaryError: primaryMessage.slice(0, 500),
        };
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error
          ? fallbackError.message
          : String(fallbackError);
        try {
          const candidateGroups = await Promise.all(MIRROR_CANDIDATE_URLS.map(downloadCsvRows));
          const candidateRows = candidateGroups.flat();
          const incomingUpdatedAt = latestCsvTimestamp(candidateRows);
          const stored = await getStoredSnapshot();
          const shouldSkip = Boolean(
            stored?.updated_at
            && incomingUpdatedAt
            && new Date(stored.updated_at).getTime() > new Date(incomingUpdatedAt).getTime(),
          );
          if (shouldSkip && stored) {
            details = {
              strategy: "tse-mirror",
              candidateCount: stored.candidate_count,
              socialCount: stored.social_count,
              assetCount: stored.asset_count,
              primaryError: primaryMessage.slice(0, 500),
              secondaryError: fallbackMessage.slice(0, 500),
              mirrorCommit: MIRROR_COMMIT,
              mirrorSkipped: true,
              snapshotUpdatedAt: incomingUpdatedAt,
            };
          } else {
            const socialGroups = await Promise.all(MIRROR_SOCIAL_URLS.map(downloadCsvRows));
            const assetGroups = await Promise.all(MIRROR_ASSET_URLS.map(downloadCsvRows));
            details = {
              strategy: "tse-mirror",
              candidateCount: await upsertCandidates(candidateRows),
              socialCount: await upsertSocials(socialGroups.flat()),
              assetCount: await upsertAssets(assetGroups.flat()),
              primaryError: primaryMessage.slice(0, 500),
              secondaryError: fallbackMessage.slice(0, 500),
              mirrorCommit: MIRROR_COMMIT,
              mirrorSkipped: false,
              snapshotUpdatedAt: incomingUpdatedAt,
            };
          }
        } catch (mirrorError) {
          const mirrorMessage = mirrorError instanceof Error ? mirrorError.message : String(mirrorError);
          throw new Error(
            `TSE Open Data: ${primaryMessage}; DivulgaCand: ${fallbackMessage}; TSE mirror: ${mirrorMessage}`,
          );
        }
      }
    }
    if (details.strategy === "tse-open-data" || details.strategy === "tse-mirror") {
      details.divulgaEnrichCount = await enrichCandidatesFromDivulgaCand();
    }
    const photoBackfillCount = await backfillCandidatePhotoUrls();
    const photoSyncDetails = options?.skipPhotos
      ? {
          photoSyncEnabled: false,
          photoSyncLimit: 0,
          photoSyncScannedCount: 0,
          photoSyncWrittenCount: 0,
          photoSyncSkippedCount: 0,
          photoSyncFailedCount: 0,
          photoSyncArchiveZipCount: 0,
          photoSyncArchivePhotoCount: 0,
          photoSyncArchiveErrors: [],
          photoSyncErrors: [],
          photoSyncSkippedOnVercel: false,
          photoSyncHint: "Photo sync skipped (--skip-photos).",
        }
      : await syncCandidatePhotos().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      return {
        photoSyncEnabled: process.env.VERCEL !== "1",
        photoSyncLimit: Number(process.env.CANDIDATE_PHOTO_SYNC_LIMIT ?? 200),
        photoSyncScannedCount: 0,
        photoSyncWrittenCount: 0,
        photoSyncSkippedCount: 0,
        photoSyncFailedCount: 0,
        photoSyncArchiveZipCount: 0,
        photoSyncArchivePhotoCount: 0,
        photoSyncArchiveErrors: [],
        photoSyncErrors: [message.slice(0, 240)],
        photoSyncSkippedOnVercel: process.env.VERCEL === "1",
        photoSyncHint: "Run npm run sync:photos from a local machine with TSE photo ZIPs.",
      };
    });
    const detailSyncDetails = options?.skipDetails
      ? {
          detailSyncEnabled: false,
          detailSyncLimit: 0,
          detailSyncScannedCount: 0,
          detailSyncUpdatedCount: 0,
          detailSyncProposalCount: 0,
          detailSyncPdfWrittenCount: 0,
          detailSyncPdfSkippedCount: 0,
          detailSyncFailedCount: 0,
          detailSyncErrors: [],
          detailSyncSkippedOnVercel: false,
          detailSyncHint: "Candidate detail sync skipped (--skip-details).",
        }
      : await syncCandidateDetails().catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          return {
            detailSyncEnabled: process.env.VERCEL !== "1",
            detailSyncLimit: Number(process.env.CANDIDATE_DETAIL_SYNC_LIMIT ?? 20_000),
            detailSyncScannedCount: 0,
            detailSyncUpdatedCount: 0,
            detailSyncProposalCount: 0,
            detailSyncPdfWrittenCount: 0,
            detailSyncPdfSkippedCount: 0,
            detailSyncFailedCount: 0,
            detailSyncErrors: [message.slice(0, 240)],
            detailSyncSkippedOnVercel: process.env.VERCEL === "1",
            detailSyncHint: "Run npm run sync:details from a local machine.",
          };
        });
    details = { ...details, photoBackfillCount, ...photoSyncDetails, ...detailSyncDetails };
    await sql.query(
      `UPDATE sync_runs SET status = 'success', finished_at = now(), details = $2::jsonb WHERE id = $1`,
      [runId, JSON.stringify(details)],
    );
    return details;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sql.query(
      `UPDATE sync_runs SET status = 'failed', finished_at = now(), error_message = $2 WHERE id = $1`,
      [runId, message.slice(0, 2000)],
    );
    throw error;
  }
}
