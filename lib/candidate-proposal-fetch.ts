import { officeHasGovernmentPlan } from "./divulga-proposals";
import { ticketMateLookupUf } from "./ticket-mate-fetch";
import type { CandidateProposal, CandidateSummary } from "./types";

export async function fetchCandidateProposals(
  candidate: Pick<CandidateSummary, "sqCandidate" | "uf" | "officeCode">,
  signal?: AbortSignal,
): Promise<CandidateProposal[]> {
  const sqCandidate = candidate.sqCandidate?.trim();
  if (!sqCandidate || !officeHasGovernmentPlan(candidate.officeCode)) return [];

  const params = new URLSearchParams({
    proposals: "1",
    sqCandidate,
    uf: ticketMateLookupUf(candidate.uf),
    office: String(candidate.officeCode),
  });

  const response = await fetch(`/api/candidates?${params}`, { signal, cache: "no-store" });
  if (!response.ok) return [];

  const data = await response.json() as { proposals?: CandidateProposal[] };
  return Array.isArray(data.proposals) ? data.proposals : [];
}
