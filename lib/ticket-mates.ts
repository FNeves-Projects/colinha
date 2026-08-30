export const SLATE_MATE_OFFICES: Record<number, number[]> = {
  1: [2],
  3: [4],
  5: [9, 10],
};

/** @deprecated use hasTicketSlate */
export const TICKET_MATE_OFFICE: Record<number, number> = {
  1: 2,
  3: 4,
};

export function slateMateOfficeCodes(headOfficeCode: number) {
  return SLATE_MATE_OFFICES[headOfficeCode] ?? [];
}

export function ticketMateOfficeCode(headOfficeCode: number) {
  return slateMateOfficeCodes(headOfficeCode)[0] ?? null;
}

export function hasTicketSlate(headOfficeCode: number) {
  return headOfficeCode in SLATE_MATE_OFFICES;
}

/** @deprecated use hasTicketSlate */
export function hasTicketMate(headOfficeCode: number) {
  return hasTicketSlate(headOfficeCode);
}

export function slateMateRoleLabel(headOfficeCode: number, mateOfficeCode: number) {
  if (mateOfficeCode === 2) return "Vice-presidente";
  if (mateOfficeCode === 4) return "Vice-governador";
  if (mateOfficeCode === 9) return "1º suplente";
  if (mateOfficeCode === 10) return "2º suplente";
  return "Chapa";
}

/** @deprecated use slateMateRoleLabel */
export function ticketMateRoleLabel(headOfficeCode: number) {
  const mateOfficeCode = ticketMateOfficeCode(headOfficeCode);
  return mateOfficeCode ? slateMateRoleLabel(headOfficeCode, mateOfficeCode) : "Vice";
}
