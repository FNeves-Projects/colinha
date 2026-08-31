import { candidateProposalPublicUrl } from "./candidate-proposal-urls";
import type { CandidateProposal } from "./types";

const DIVULGA_BASE = "https://divulgacandcontas.tse.jus.br/divulga";
const GOVERNMENT_PLAN_COD_TIPO = "5";

export function officeHasGovernmentPlan(officeCode: number) {
  return officeCode === 1 || officeCode === 3;
}

type DivulgaFile = {
  idArquivo?: number | string;
  nome?: string;
  codTipo?: string;
  anonimizado?: string | null;
};

export function tseProposalDocumentUrl(idArquivo: number | string) {
  return `${DIVULGA_BASE}/rest/arquivo/doc/${idArquivo}`;
}

export function resolveStoredProposalUrl(tseFileId: string, localUrl: string | null) {
  return localUrl || candidateProposalPublicUrl(tseFileId);
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
  return file.codTipo === GOVERNMENT_PLAN_COD_TIPO;
}

function proposalTitle(file: DivulgaFile) {
  const name = file.nome?.trim();
  return name ? name.replace(/\.pdf$/i, "").trim() : "Plano de governo";
}

export function extractProposalsFromDivulgaFiles(files: DivulgaFile[]): CandidateProposal[] {
  const seen = new Set<string>();

  return files
    .filter(isPublicProposalFile)
    .flatMap((file) => {
      const id = String(file.idArquivo ?? "").trim();
      if (!id || seen.has(id)) return [];
      seen.add(id);
      return [{ id, title: proposalTitle(file), url: candidateProposalPublicUrl(id) }];
    });
}

export function proposalDownloadFileName(title: string) {
  const clean = title.replace(/[^\w\sÀ-ú().-]+/gi, "").trim();
  const base = clean || "proposta";
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}
