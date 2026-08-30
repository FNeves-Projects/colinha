import { normalizeCandidateUf, TSE_ELECTION_ID_2026 } from "./tse-urls";
import type { Candidate } from "./types";

const DIVULGA_BASE = "https://divulgacandcontas.tse.jus.br/divulga";

type DivulgaDetail = {
  descricaoSituacao?: string;
  situacaoCandidato?: string;
  descricaoSituacaoCandidato?: string;
  descricaoTotalizacao?: string;
  ocupacao?: string;
  grauInstrucao?: string;
  dataDeNascimento?: string | number;
};

function divulgaDate(value?: string | number) {
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split("/");
    return `${year}-${month}-${day}`;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function cleanLiveValue(value?: string | null) {
  const clean = value?.trim();
  return clean && !["#NULO#", "#NE", "-1"].includes(clean) ? clean : null;
}

export function candidateNeedsLiveDetails(candidate: Pick<Candidate, "status" | "occupation" | "education">) {
  return !candidate.status || !candidate.occupation || !candidate.education;
}

export async function fetchCandidateLiveDetails(input: {
  sqCandidate: string;
  uf: string;
}): Promise<Partial<Pick<Candidate, "status" | "occupation" | "education" | "birthDate">> | null> {
  const sqCandidate = input.sqCandidate.trim();
  if (!sqCandidate) return null;

  const uf = normalizeCandidateUf(input.uf);
  const url = `${DIVULGA_BASE}/rest/v1/candidatura/buscar/2026/${uf}/${TSE_ELECTION_ID_2026}/candidato/${sqCandidate}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "ColinhaDigital/1.0" },
    signal: AbortSignal.timeout(12_000),
    next: { revalidate: 3600 },
  });
  if (!response.ok) return null;

  const detail = await response.json() as DivulgaDetail;
  return {
    status: cleanLiveValue(detail.descricaoSituacao) ?? cleanLiveValue(detail.situacaoCandidato),
    occupation: cleanLiveValue(detail.ocupacao),
    education: cleanLiveValue(detail.grauInstrucao),
    birthDate: divulgaDate(detail.dataDeNascimento),
  };
}

export function mergeCandidateLiveDetails(
  candidate: Candidate,
  live: Partial<Pick<Candidate, "status" | "occupation" | "education" | "birthDate">> | null,
): Candidate {
  if (!live) return candidate;
  return {
    ...candidate,
    status: candidate.status ?? live.status ?? null,
    occupation: candidate.occupation ?? live.occupation ?? null,
    education: candidate.education ?? live.education ?? null,
    birthDate: candidate.birthDate ?? live.birthDate ?? null,
  };
}
