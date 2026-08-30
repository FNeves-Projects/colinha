import { candidatePhotoPublicUrl } from "./candidate-photo-urls";
import { TERESINHA_SQ_CANDIDATE } from "./tse-urls";
import type { Candidate, CandidateSummary } from "./types";

export const TERESINHA_ID = "campaign-teresinha-neves-2026";
export const TERESINHA_BALLOT_NUMBER = "3088";

export function isTeresinhaCandidate(
  candidate: Pick<CandidateSummary, "id" | "sqCandidate">,
) {
  return candidate.id === TERESINHA_ID || candidate.sqCandidate === TERESINHA_SQ_CANDIDATE;
}

/** Bootstrap for the fixed federal slot before synced TSE data is loaded. */
export function teresinhaPlaceholderSummary(): CandidateSummary {
  return {
    id: TERESINHA_ID,
    sqCandidate: TERESINHA_SQ_CANDIDATE,
    officeCode: 6,
    officeName: "Deputada Federal",
    ballotNumber: TERESINHA_BALLOT_NUMBER,
    ballotName: "…",
    fullName: "…",
    partyAcronym: null,
    status: null,
    photoUrl: candidatePhotoPublicUrl(TERESINHA_SQ_CANDIDATE),
    uf: "SP",
    source: "TSE",
  };
}

export function applyTeresinhaSlotIdentity<T extends Candidate | CandidateSummary>(candidate: T): T {
  if (!isTeresinhaCandidate(candidate)) return candidate;
  return { ...candidate, id: TERESINHA_ID };
}
