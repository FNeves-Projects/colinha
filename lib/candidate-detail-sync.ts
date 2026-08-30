import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { candidateProposalPublicUrl } from "./candidate-proposal-urls";
import { formatBirthplace } from "./candidate-live-details";
import { extractProposalsFromDivulgaFiles, tseProposalDocumentUrl } from "./divulga-proposals";
import { getSql } from "./db";
import { normalizeCandidateUf, TSE_ELECTION_ID_2026 } from "./tse-urls";
import type { CandidateProposal } from "./types";

const DIVULGA_BASE = "https://divulgacandcontas.tse.jus.br/divulga";

type DivulgaDetail = {
  descricaoSexo?: string;
  descricaoEstadoCivil?: string;
  nacionalidade?: string;
  descricaoNaturalidade?: string;
  nomeMunicipioNascimento?: string;
  sgUfNascimento?: string;
  arquivos?: Array<{
    idArquivo?: number | string;
    nome?: string;
    codTipo?: string;
    anonimizado?: string | null;
  }>;
};

type CandidateDetailRow = {
  id: string;
  sq_candidate: string;
  uf: string;
};

export type CandidateDetailSyncResult = {
  detailSyncEnabled: boolean;
  detailSyncLimit: number;
  detailSyncScannedCount: number;
  detailSyncUpdatedCount: number;
  detailSyncProposalCount: number;
  detailSyncPdfWrittenCount: number;
  detailSyncPdfSkippedCount: number;
  detailSyncFailedCount: number;
  detailSyncErrors: string[];
  detailSyncSkippedOnVercel: boolean;
  detailSyncHint?: string;
};

export type CandidateDetailSyncOptions = {
  limit?: number;
  concurrency?: number;
  forceDownload?: boolean;
  onProgress?: (message: string) => void;
};

export const CANDIDATE_PROPOSAL_OUTPUT_DIR = path.join(process.cwd(), "public/candidate-proposals");

const DEFAULT_DETAIL_SYNC_LIMIT = 20_000;
const DEFAULT_WRITE_CONCURRENCY = 6;
const LOCAL_SYNC_HINT =
  "Run npm run sync:details from a local machine to fetch DivulgaCand profile fields and proposal PDFs.";

function isRunningOnVercel() {
  return process.env.VERCEL === "1";
}

function parseDetailSyncLimit(fallback: number) {
  const raw = process.env.CANDIDATE_DETAIL_SYNC_LIMIT;
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function cleanStoredValue(value?: string | null) {
  const clean = value?.trim();
  return clean && !["#NULO#", "#NE", "-1"].includes(clean) ? clean : null;
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
) {
  const size = Math.max(1, concurrency);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(size, items.length) }, runWorker));
}

async function fetchDivulgaDetail(sqCandidate: string, uf: string) {
  const normalizedUf = normalizeCandidateUf(uf);
  const url = `${DIVULGA_BASE}/rest/v1/candidatura/buscar/2026/${normalizedUf}/${TSE_ELECTION_ID_2026}/candidato/${sqCandidate}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "ColinhaDigital/1.0" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return null;
  return await response.json() as DivulgaDetail;
}

async function ensureProposalPdf(fileId: string, forceDownload: boolean) {
  await fs.mkdir(CANDIDATE_PROPOSAL_OUTPUT_DIR, { recursive: true });
  const dest = path.join(CANDIDATE_PROPOSAL_OUTPUT_DIR, `${fileId}.pdf`);
  if (!forceDownload) {
    try {
      await fs.access(dest);
      return { localUrl: candidateProposalPublicUrl(fileId), written: false };
    } catch {
      // download below
    }
  }

  const response = await fetch(tseProposalDocumentUrl(fileId), {
    headers: { Accept: "application/pdf", "User-Agent": "ColinhaDigital/1.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`proposal pdf ${fileId} returned ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength < 512) {
    throw new Error(`proposal pdf ${fileId} looks too small (${bytes.byteLength} bytes)`);
  }

  await fs.writeFile(dest, bytes);
  return { localUrl: candidateProposalPublicUrl(fileId), written: true };
}

async function replaceCandidateProposals(candidateId: string, proposals: CandidateProposal[]) {
  const sql = getSql();
  await sql.query(`DELETE FROM candidate_proposals WHERE candidate_id = $1`, [candidateId]);
  if (!proposals.length) return;

  await sql.query(
    `INSERT INTO candidate_proposals (candidate_id, tse_file_id, title, local_url)
     SELECT $1::bigint, x.tse_file_id, x.title, x.local_url
       FROM jsonb_to_recordset($2::jsonb) AS x(tse_file_id text, title text, local_url text)`,
    [
      candidateId,
      JSON.stringify(proposals.map((proposal) => ({
        tse_file_id: proposal.id,
        title: proposal.title,
        local_url: proposal.url.startsWith("/candidate-proposals/") ? proposal.url : null,
      }))),
    ],
  );
}

export async function syncCandidateDetails(
  options: CandidateDetailSyncOptions = {},
): Promise<CandidateDetailSyncResult> {
  if (isRunningOnVercel()) {
    return {
      detailSyncEnabled: false,
      detailSyncLimit: 0,
      detailSyncScannedCount: 0,
      detailSyncUpdatedCount: 0,
      detailSyncProposalCount: 0,
      detailSyncPdfWrittenCount: 0,
      detailSyncPdfSkippedCount: 0,
      detailSyncFailedCount: 0,
      detailSyncErrors: [],
      detailSyncSkippedOnVercel: true,
      detailSyncHint: LOCAL_SYNC_HINT,
    };
  }

  const sql = getSql();
  const limit = options.limit ?? parseDetailSyncLimit(DEFAULT_DETAIL_SYNC_LIMIT);
  const concurrency = options.concurrency ?? DEFAULT_WRITE_CONCURRENCY;
  const forceDownload = options.forceDownload ?? false;
  const onProgress = options.onProgress;

  const rows = await sql.query(
    `SELECT id::text, sq_candidate, uf
       FROM candidates
      WHERE election_year = 2026
        AND uf IN ('SP', 'BR')
        AND source = 'TSE'
        AND sq_candidate ~ '^[0-9]+$'
      ORDER BY office_code, ballot_name
      LIMIT $1`,
    [limit],
  ) as CandidateDetailRow[];

  let updatedCount = 0;
  let proposalCount = 0;
  let pdfWrittenCount = 0;
  let pdfSkippedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  await mapPool(rows, concurrency, async (row, index) => {
    try {
      const detail = await fetchDivulgaDetail(row.sq_candidate, row.uf);
      if (!detail) {
        failedCount += 1;
        if (errors.length < 20) {
          errors.push(`${row.sq_candidate}: DivulgaCand detail unavailable`);
        }
        return;
      }

      const nationality = cleanStoredValue(detail.nacionalidade);
      const birthplace = formatBirthplace(detail);
      const gender = cleanStoredValue(detail.descricaoSexo);
      const maritalStatus = cleanStoredValue(detail.descricaoEstadoCivil);

      await sql.query(
        `UPDATE candidates
            SET nationality = COALESCE($2, nationality),
                birthplace = COALESCE($3, birthplace),
                gender = COALESCE($4, gender),
                marital_status = COALESCE($5, marital_status),
                updated_at = now()
          WHERE id = $1::bigint`,
        [row.id, nationality, birthplace, gender, maritalStatus],
      );

      const extracted = extractProposalsFromDivulgaFiles(Array.isArray(detail.arquivos) ? detail.arquivos : []);
      const storedProposals: CandidateProposal[] = [];

      for (const proposal of extracted) {
        try {
          const pdf = await ensureProposalPdf(proposal.id, forceDownload);
          if (pdf.written) pdfWrittenCount += 1;
          else pdfSkippedCount += 1;
          storedProposals.push({ ...proposal, url: pdf.localUrl });
        } catch (error) {
          failedCount += 1;
          const message = error instanceof Error ? error.message : String(error);
          if (errors.length < 20) errors.push(`${row.sq_candidate}/${proposal.id}: ${message}`);
          storedProposals.push(proposal);
        }
      }

      await replaceCandidateProposals(row.id, storedProposals);
      updatedCount += 1;
      proposalCount += storedProposals.length;

      if (onProgress && (index + 1) % 25 === 0) {
        onProgress(`Synced ${index + 1}/${rows.length} candidate profiles...`);
      }
    } catch (error) {
      failedCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      if (errors.length < 20) errors.push(`${row.sq_candidate}: ${message.slice(0, 180)}`);
    }
  });

  return {
    detailSyncEnabled: true,
    detailSyncLimit: limit,
    detailSyncScannedCount: rows.length,
    detailSyncUpdatedCount: updatedCount,
    detailSyncProposalCount: proposalCount,
    detailSyncPdfWrittenCount: pdfWrittenCount,
    detailSyncPdfSkippedCount: pdfSkippedCount,
    detailSyncFailedCount: failedCount,
    detailSyncErrors: errors,
    detailSyncSkippedOnVercel: false,
    detailSyncHint: rows.length ? undefined : "No candidates found to sync.",
  };
}
