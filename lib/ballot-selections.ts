import type { CandidateSummary } from "./types";

export type SpecialVoteKind = "branco" | "nulo";

export type OfficeSelection =
  | { type: "candidate"; candidate: CandidateSummary }
  | { type: "special"; vote: SpecialVoteKind }
  | null;

export type Selections = Record<string, OfficeSelection>;

export function nullBallotNumber(digits: number) {
  return "0".repeat(digits);
}

export function selectionCandidate(selection: OfficeSelection) {
  return selection?.type === "candidate" ? selection.candidate : null;
}

export function selectionIsSpecial(selection: OfficeSelection, vote?: SpecialVoteKind) {
  if (!selection || selection.type !== "special") return false;
  return vote ? selection.vote === vote : true;
}

export function selectionBallotNumber(selection: OfficeSelection, digits: number) {
  if (selection?.type === "candidate") return selection.candidate.ballotNumber;
  if (selection?.type === "special" && selection.vote === "nulo") return nullBallotNumber(digits);
  return null;
}

export function selectionShareLine(label: string, selection: OfficeSelection, digits: number) {
  if (!selection) return `${label}: escolha pendente`;
  if (selection.type === "special") {
    return selection.vote === "branco"
      ? `${label}: Branco`
      : `${label}: Nulo (${nullBallotNumber(digits)})`;
  }
  return `${label}: ${selection.candidate.ballotName} — nº ${selection.candidate.ballotNumber}`;
}

export function selectionNotice(selection: OfficeSelection) {
  if (selection?.type === "special") {
    return selection.vote === "branco"
      ? "Voto em branco registrado na colinha."
      : "Voto nulo registrado na colinha.";
  }
  if (selection?.type === "candidate") {
    return `${selection.candidate.ballotName} foi adicionado à sua colinha.`;
  }
  return "";
}

function isLegacyCandidate(value: unknown): value is CandidateSummary {
  return Boolean(
    value
    && typeof value === "object"
    && "ballotNumber" in value
    && "ballotName" in value,
  );
}

export function normalizeOfficeSelection(value: unknown): OfficeSelection {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "type" in value) {
    const typed = value as { type: string; vote?: string; candidate?: unknown };
    if (typed.type === "special" && (typed.vote === "branco" || typed.vote === "nulo")) {
      return { type: "special", vote: typed.vote };
    }
    if (typed.type === "candidate" && isLegacyCandidate(typed.candidate)) {
      return { type: "candidate", candidate: typed.candidate };
    }
  }
  if (isLegacyCandidate(value)) {
    return { type: "candidate", candidate: value };
  }
  return null;
}

export function normalizeSelections(raw: Record<string, unknown> | undefined): Selections {
  if (!raw) return {};
  return Object.fromEntries(
    Object.entries(raw).map(([officeId, value]) => [officeId, normalizeOfficeSelection(value)]),
  );
}
