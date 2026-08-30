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

export function proposalPdfApiUrl(proposal: Pick<CandidateProposal, "id" | "url">, download = false) {
  if (proposal.url.startsWith("/candidate-proposals/")) {
    return download ? `${proposal.url}?download=1` : proposal.url;
  }

  const params = new URLSearchParams({
    proposalPdf: "1",
    fileId: proposal.id,
  });
  if (download) params.set("download", "1");
  return `/api/candidates?${params}`;
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

export function extractProposalsFromDivulgaFiles(files: DivulgaFile[]): CandidateProposal[] {
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

export function proposalDownloadFileName(title: string) {
  const clean = title.replace(/[^\w\sÀ-ú().-]+/gi, "").trim();
  const base = clean || "proposta";
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}
