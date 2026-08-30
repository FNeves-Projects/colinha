import "server-only";

import { normalizeCandidateUf, TSE_ELECTION_ID_2026 } from "./tse-urls";
import type { CandidateProposal } from "./types";

const DIVULGA_BASE = "https://divulgacandcontas.tse.jus.br/divulga";
const GOVERNMENT_PLAN_COD_TIPO = "5";
const LEGISLATIVE_PROPOSAL_PATTERN = /DEPUTADO FEDERAL|DEPUTADO ESTADUAL|SENADOR/i;

type DivulgaFile = {
  idArquivo?: number | string;
  nome?: string;
  codTipo?: string;
  anonimizado?: string | null;
};

export function tseProposalDocumentUrl(idArquivo: number | string) {
  return `${DIVULGA_BASE}/rest/arquivo/doc/${idArquivo}`;
}

function isPublicProposalFile(file: DivulgaFile) {
  if (file.anonimizado === "S") return false;
  if (file.codTipo === GOVERNMENT_PLAN_COD_TIPO) return true;
  const name = file.nome?.trim() ?? "";
  return /^pje-/i.test(name) && LEGISLATIVE_PROPOSAL_PATTERN.test(name);
}

function proposalTitle(file: DivulgaFile) {
  if (file.codTipo === GOVERNMENT_PLAN_COD_TIPO) {
    const name = file.nome?.trim();
    return name ? name.replace(/\.pdf$/i, "").trim() : "Plano de governo";
  }
  return "Ver proposta";
}

function proposalSortRank(file: DivulgaFile) {
  if (file.codTipo === GOVERNMENT_PLAN_COD_TIPO) return 0;
  return 1;
}

function extractProposals(files: DivulgaFile[]): CandidateProposal[] {
  const seen = new Set<string>();

  return files
    .filter(isPublicProposalFile)
    .sort((left, right) => proposalSortRank(left) - proposalSortRank(right))
    .flatMap((file) => {
      const id = String(file.idArquivo ?? "").trim();
      if (!id || seen.has(id)) return [];
      seen.add(id);
      return [{ id, title: proposalTitle(file), url: tseProposalDocumentUrl(id) }];
    });
}

export async function getCandidateProposals(input: {
  sqCandidate: string;
  uf: string;
}): Promise<CandidateProposal[]> {
  const uf = normalizeCandidateUf(input.uf);
  const sqCandidate = input.sqCandidate.trim();
  if (!sqCandidate) return [];

  const url = `${DIVULGA_BASE}/rest/v1/candidatura/buscar/2026/${uf}/${TSE_ELECTION_ID_2026}/candidato/${sqCandidate}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "ColinhaDigital/1.0" },
    signal: AbortSignal.timeout(15_000),
    next: { revalidate: 3600 },
  });
  if (!response.ok) return [];

  const payload = await response.json() as { arquivos?: DivulgaFile[] };
  return extractProposals(Array.isArray(payload.arquivos) ? payload.arquivos : []);
}
