export const TSE_ELECTION_ID_2026 = "20322002026";
export const TSE_CANDIDATE_PHOTO_BASE =
  `https://divulgacandcontas.tse.jus.br/divulga/rest/arquivo/img/${TSE_ELECTION_ID_2026}`;
export const TERESINHA_SQ_CANDIDATE = "250002530169";
export const DIVULGA_CANDIDATE_BASE = "https://divulgacandcontas.tse.jus.br/divulga/#/candidato";

export const DEFAULT_TSE_PHOTO_ZIP_URLS = [
  "https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_SP.zip",
  "https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_SP_div.zip",
  "https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_BR.zip",
  "https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_BR_div.zip",
] as const;

const UF_TO_REGION: Record<string, string> = {
  AC: "NORTE",
  AL: "NORDESTE",
  AP: "NORTE",
  AM: "NORTE",
  BA: "NORDESTE",
  BR: "BRASIL",
  CE: "NORDESTE",
  DF: "CENTROOESTE",
  ES: "SUDESTE",
  GO: "CENTROOESTE",
  MA: "NORDESTE",
  MG: "SUDESTE",
  MS: "CENTROOESTE",
  MT: "CENTROOESTE",
  PA: "NORTE",
  PB: "NORDESTE",
  PE: "NORDESTE",
  PI: "NORDESTE",
  PR: "SUL",
  RJ: "SUDESTE",
  RN: "NORDESTE",
  RO: "NORTE",
  RR: "NORTE",
  RS: "SUL",
  SC: "SUL",
  SE: "NORDESTE",
  SP: "SUDESTE",
  TO: "NORTE",
};

export function normalizeCandidateUf(uf: string) {
  const normalized = uf.trim().toUpperCase();
  if (normalized === "BRASIL") return "BR";
  return normalized;
}

export function tseRegionForUf(uf: string) {
  const normalizedUf = normalizeCandidateUf(uf);
  return UF_TO_REGION[normalizedUf] ?? "BRASIL";
}

export function tseCandidateUrl(uf: string, sqCandidate: string, electionYear = 2026) {
  const normalizedUf = normalizeCandidateUf(uf);
  const region = tseRegionForUf(normalizedUf);
  return `${DIVULGA_CANDIDATE_BASE}/${region}/${normalizedUf}/${TSE_ELECTION_ID_2026}/${sqCandidate}/${electionYear}/${normalizedUf}`;
}

export function tseCandidatePhotoUrl(sqCandidate: string) {
  return `${TSE_CANDIDATE_PHOTO_BASE}/${sqCandidate}/70750`;
}

export function tseCandidatePhotoDownloadUrl(sqCandidate: string, uf: string) {
  return `${TSE_CANDIDATE_PHOTO_BASE}/${sqCandidate}/${normalizeCandidateUf(uf)}`;
}
