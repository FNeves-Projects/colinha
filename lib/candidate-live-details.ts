import { extractProposalsFromDivulgaFiles } from "./divulga-proposals";
import { normalizeCandidateUf, TSE_ELECTION_ID_2026 } from "./tse-urls";
import type { Candidate, CandidateProposal } from "./types";

const DIVULGA_BASE = "https://divulgacandcontas.tse.jus.br/divulga";

type DivulgaDetail = {
  descricaoSituacao?: string;
  situacaoCandidato?: string;
  descricaoSituacaoCandidato?: string;
  descricaoTotalizacao?: string;
  ocupacao?: string;
  grauInstrucao?: string;
  dataDeNascimento?: string | number;
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

export type CandidateLiveBundle = {
  details: Partial<
    Pick<
      Candidate,
      | "status"
      | "occupation"
      | "education"
      | "birthDate"
      | "gender"
      | "maritalStatus"
      | "nationality"
      | "birthplace"
    >
  >;
  proposals: CandidateProposal[];
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

export function formatBirthplace(detail: Pick<DivulgaDetail, "descricaoNaturalidade" | "nomeMunicipioNascimento" | "sgUfNascimento">) {
  const naturalidade = cleanLiveValue(detail.descricaoNaturalidade);
  if (naturalidade && !/null/i.test(naturalidade)) return naturalidade;

  const city = cleanLiveValue(detail.nomeMunicipioNascimento);
  const uf = cleanLiveValue(detail.sgUfNascimento);
  if (city && uf) return `${city} (${uf})`;
  return city ?? uf ?? null;
}

export function formatGenderLabel(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.replace(/\./g, "").trim().toUpperCase();
  if (normalized.startsWith("MASC")) return "Masculino";
  if (normalized.startsWith("FEM")) return "Feminino";
  return value;
}

export function candidateNeedsLiveDetails(
  candidate: Pick<Candidate, "status" | "occupation" | "education" | "gender" | "maritalStatus" | "nationality" | "birthplace">,
) {
  return (
    !candidate.status
    || !candidate.occupation
    || !candidate.education
    || !candidate.gender
    || !candidate.maritalStatus
    || !candidate.nationality
    || !candidate.birthplace
  );
}

export function candidateNeedsLiveProposals(candidate: Pick<Candidate, "proposals">) {
  return candidate.proposals === undefined;
}

export function candidateNeedsLiveEnrichment(candidate: Candidate) {
  return candidateNeedsLiveDetails(candidate) || candidateNeedsLiveProposals(candidate);
}

async function fetchDivulgaDetail(input: { sqCandidate: string; uf: string }) {
  const sqCandidate = input.sqCandidate.trim();
  if (!sqCandidate) return null;

  const uf = normalizeCandidateUf(input.uf);
  const url = `${DIVULGA_BASE}/rest/v1/candidatura/buscar/2026/${uf}/${TSE_ELECTION_ID_2026}/candidato/${sqCandidate}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "ColinhaDigital/1.0" },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return await response.json() as DivulgaDetail;
}

export async function fetchCandidateLiveBundle(input: {
  sqCandidate: string;
  uf: string;
}): Promise<CandidateLiveBundle | null> {
  const detail = await fetchDivulgaDetail(input);
  if (!detail) return null;

  return {
    details: {
      status: cleanLiveValue(detail.descricaoSituacao) ?? cleanLiveValue(detail.situacaoCandidato),
      occupation: cleanLiveValue(detail.ocupacao),
      education: cleanLiveValue(detail.grauInstrucao),
      birthDate: divulgaDate(detail.dataDeNascimento),
      gender: cleanLiveValue(detail.descricaoSexo),
      maritalStatus: cleanLiveValue(detail.descricaoEstadoCivil),
      nationality: cleanLiveValue(detail.nacionalidade),
      birthplace: formatBirthplace(detail),
    },
    proposals: extractProposalsFromDivulgaFiles(Array.isArray(detail.arquivos) ? detail.arquivos : []),
  };
}

/** @deprecated use fetchCandidateLiveBundle */
export async function fetchCandidateLiveDetails(input: {
  sqCandidate: string;
  uf: string;
}): Promise<
  Partial<
    Pick<
      Candidate,
      | "status"
      | "occupation"
      | "education"
      | "birthDate"
      | "gender"
      | "maritalStatus"
      | "nationality"
      | "birthplace"
    >
  > | null
> {
  const bundle = await fetchCandidateLiveBundle(input);
  return bundle?.details ?? null;
}

export function mergeCandidateLiveBundle(candidate: Candidate, bundle: CandidateLiveBundle | null): Candidate {
  if (!bundle) {
    return candidate.proposals === undefined ? { ...candidate, proposals: [] } : candidate;
  }

  return {
    ...candidate,
    status: candidate.status ?? bundle.details.status ?? null,
    occupation: candidate.occupation ?? bundle.details.occupation ?? null,
    education: candidate.education ?? bundle.details.education ?? null,
    birthDate: candidate.birthDate ?? bundle.details.birthDate ?? null,
    gender: candidate.gender ?? bundle.details.gender ?? null,
    maritalStatus: candidate.maritalStatus ?? bundle.details.maritalStatus ?? null,
    nationality: candidate.nationality ?? bundle.details.nationality ?? null,
    birthplace: candidate.birthplace ?? bundle.details.birthplace ?? null,
    proposals: bundle.proposals,
  };
}

/** @deprecated use mergeCandidateLiveBundle */
export function mergeCandidateLiveDetails(
  candidate: Candidate,
  live: Partial<
    Pick<
      Candidate,
      | "status"
      | "occupation"
      | "education"
      | "birthDate"
      | "gender"
      | "maritalStatus"
      | "nationality"
      | "birthplace"
    >
  > | null,
): Candidate {
  if (!live) return candidate;
  return {
    ...candidate,
    status: candidate.status ?? live.status ?? null,
    occupation: candidate.occupation ?? live.occupation ?? null,
    education: candidate.education ?? live.education ?? null,
    birthDate: candidate.birthDate ?? live.birthDate ?? null,
    gender: candidate.gender ?? live.gender ?? null,
    maritalStatus: candidate.maritalStatus ?? live.maritalStatus ?? null,
    nationality: candidate.nationality ?? live.nationality ?? null,
    birthplace: candidate.birthplace ?? live.birthplace ?? null,
  };
}
