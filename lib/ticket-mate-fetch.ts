import type { Office } from "./offices";
import { hasTicketSlate } from "./ticket-mates";
import type { CandidateSummary } from "./types";
import type { OfficeSelection, Selections } from "./ballot-selections";
import { OFFICES } from "./offices";

export function ticketMateLookupUf(uf: string, jurisdiction?: Office["jurisdiction"]) {
  if (jurisdiction) return jurisdiction;
  return uf === "BRASIL" ? "BR" : uf;
}

export async function fetchTicketChapaForCandidate(
  candidate: Pick<CandidateSummary, "id" | "officeCode" | "ballotNumber" | "uf">,
  signal?: AbortSignal,
): Promise<CandidateSummary[]> {
  const params = new URLSearchParams({
    ticketChapa: "1",
    office: String(candidate.officeCode),
    candidateId: candidate.id,
    ballot: candidate.ballotNumber,
    uf: ticketMateLookupUf(candidate.uf),
    year: "2026",
  });

  const response = await fetch(`/api/candidates?${params}`, { signal, cache: "no-store" });
  if (!response.ok) return [];
  const data = await response.json() as { slate?: CandidateSummary[] };
  return Array.isArray(data.slate) ? data.slate : [];
}

export async function fetchTicketSlateForCandidate(
  candidate: Pick<CandidateSummary, "officeCode" | "ballotNumber" | "uf">,
  signal?: AbortSignal,
): Promise<CandidateSummary[]> {
  if (!hasTicketSlate(candidate.officeCode)) return [];

  const params = new URLSearchParams({
    ticketMate: "1",
    headOffice: String(candidate.officeCode),
    ballot: candidate.ballotNumber,
    uf: ticketMateLookupUf(candidate.uf),
    year: "2026",
  });

  const response = await fetch(`/api/candidates?${params}`, { signal, cache: "no-store" });
  if (!response.ok) return [];
  const data = await response.json() as { slate?: CandidateSummary[] };
  return Array.isArray(data.slate) ? data.slate : [];
}

export async function fetchTicketSlateForOffice(
  office: Office,
  candidate: CandidateSummary,
  signal?: AbortSignal,
): Promise<CandidateSummary[]> {
  if (!hasTicketSlate(candidate.officeCode)) return [];

  const params = new URLSearchParams({
    ticketMate: "1",
    headOffice: String(candidate.officeCode),
    ballot: candidate.ballotNumber,
    uf: office.jurisdiction,
    year: "2026",
  });

  const response = await fetch(`/api/candidates?${params}`, { signal, cache: "no-store" });
  if (!response.ok) return [];
  const data = await response.json() as { slate?: CandidateSummary[] };
  return Array.isArray(data.slate) ? data.slate : [];
}

/** @deprecated use fetchTicketSlateForOffice */
export async function fetchTicketMateForOffice(
  office: Office,
  candidate: CandidateSummary,
  signal?: AbortSignal,
): Promise<CandidateSummary | null> {
  const slate = await fetchTicketSlateForOffice(office, candidate, signal);
  return slate[0] ?? null;
}

export function officesWithTicketSlateSelections(selections: Selections) {
  return OFFICES.filter((office) => {
    const selection = selections[office.id];
    return selection?.type === "candidate" && hasTicketSlate(selection.candidate.officeCode);
  });
}

/** @deprecated use officesWithTicketSlateSelections */
export const officesWithTicketMateSelections = officesWithTicketSlateSelections;

export function selectionTicketMateCandidate(selection: OfficeSelection) {
  return selection?.type === "candidate" && hasTicketSlate(selection.candidate.officeCode)
    ? selection.candidate
    : null;
}
