import "server-only";

import { extractProposalsFromDivulgaFiles, officeHasGovernmentPlan } from "./divulga-proposals";
import { normalizeCandidateUf, TSE_ELECTION_ID_2026 } from "./tse-urls";
import type { CandidateProposal } from "./types";

const DIVULGA_BASE = "https://divulgacandcontas.tse.jus.br/divulga";

type DivulgaDetail = {
  arquivos?: Array<{
    idArquivo?: number | string;
    nome?: string;
    codTipo?: string;
    anonimizado?: string | null;
  }>;
};

export { tseProposalDocumentUrl } from "./divulga-proposals";

export async function getCandidateProposals(input: {
  sqCandidate: string;
  uf: string;
  officeCode: number;
}): Promise<CandidateProposal[]> {
  const sqCandidate = input.sqCandidate.trim();
  if (!sqCandidate || !officeHasGovernmentPlan(input.officeCode)) return [];

  const uf = normalizeCandidateUf(input.uf);
  const url = `${DIVULGA_BASE}/rest/v1/candidatura/buscar/2026/${uf}/${TSE_ELECTION_ID_2026}/candidato/${sqCandidate}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "ColinhaDigital/1.0" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) return [];

  const payload = await response.json() as DivulgaDetail;
  return extractProposalsFromDivulgaFiles(Array.isArray(payload.arquivos) ? payload.arquivos : []);
}
