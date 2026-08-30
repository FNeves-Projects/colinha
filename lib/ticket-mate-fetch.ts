import type { Office } from "./offices";
import { hasTicketMate } from "./ticket-mates";
import type { CandidateSummary } from "./types";
import type { OfficeSelection, Selections } from "./ballot-selections";
import { OFFICES } from "./offices";

export function ticketMateLookupUf(uf: string, jurisdiction?: Office["jurisdiction"]) {
  if (jurisdiction) return jurisdiction;
  return uf === "BRASIL" ? "BR" : uf;
}

export async function fetchTicketMateForOffice(
  office: Office,
  candidate: CandidateSummary,
  signal?: AbortSignal,
): Promise<CandidateSummary | null> {
  if (!hasTicketMate(candidate.officeCode)) return null;

  const params = new URLSearchParams({
    ticketMate: "1",
    headOffice: String(candidate.officeCode),
    ballot: candidate.ballotNumber,
    uf: office.jurisdiction,
    year: "2026",
  });

  const response = await fetch(`/api/candidates?${params}`, { signal, cache: "no-store" });
  if (!response.ok) return null;
  const data = await response.json() as { ticketMate?: CandidateSummary | null };
  return data.ticketMate ?? null;
}

export function officesWithTicketMateSelections(selections: Selections) {
  return OFFICES.filter((office) => {
    const selection = selections[office.id];
    return selection?.type === "candidate" && hasTicketMate(selection.candidate.officeCode);
  });
}

export function selectionTicketMateCandidate(selection: OfficeSelection) {
  return selection?.type === "candidate" && hasTicketMate(selection.candidate.officeCode)
    ? selection.candidate
    : null;
}
