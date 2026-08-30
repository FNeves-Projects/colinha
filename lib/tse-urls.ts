export const TSE_ELECTION_ID_2026 = "20322002026";
export const TSE_CANDIDATE_PHOTO_BASE =
  `https://divulgacandcontas.tse.jus.br/divulga/rest/arquivo/img/${TSE_ELECTION_ID_2026}`;
export const TERESINHA_SQ_CANDIDATE = "250002530169";

export const DEFAULT_TSE_PHOTO_ZIP_URLS = [
  "https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_SP.zip",
  "https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_SP_div.zip",
  "https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_BR.zip",
  "https://cdn.tse.jus.br/estatistica/sead/odsele/fotos/foto_cand2026_BR_div.zip",
] as const;

export function tseCandidateUrl(uf: string, sqCandidate: string) {
  return `https://divulgacandcontas.tse.jus.br/divulga/#/candidato/2026/${TSE_ELECTION_ID_2026}/${uf}/${sqCandidate}`;
}

export function tseCandidatePhotoUrl(sqCandidate: string) {
  return `${TSE_CANDIDATE_PHOTO_BASE}/${sqCandidate}/70750`;
}

export function tseCandidatePhotoDownloadUrl(sqCandidate: string, uf: string) {
  return `${TSE_CANDIDATE_PHOTO_BASE}/${sqCandidate}/${uf}`;
}
