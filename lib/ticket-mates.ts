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

export function ticketHeadOfficeCode(mateOfficeCode: number) {
  for (const [headOfficeCode, mateOfficeCodes] of Object.entries(SLATE_MATE_OFFICES)) {
    if (mateOfficeCodes.includes(mateOfficeCode)) return Number(headOfficeCode);
  }
  return null;
}

export function ticketHeadOfficeCodeFor(officeCode: number) {
  if (hasTicketSlate(officeCode)) return officeCode;
  return ticketHeadOfficeCode(officeCode);
}

export function isTicketChapaMember(officeCode: number) {
  return ticketHeadOfficeCodeFor(officeCode) !== null;
}

export function slateHeadRoleLabel(headOfficeCode: number) {
  if (headOfficeCode === 1) return "Presidente";
  if (headOfficeCode === 3) return "Governador";
  if (headOfficeCode === 5) return "Senador";
  return "Titular";
}

export function slateMemberRoleLabel(headOfficeCode: number, memberOfficeCode: number) {
  if (memberOfficeCode === headOfficeCode) return slateHeadRoleLabel(headOfficeCode);
  return slateMateRoleLabel(headOfficeCode, memberOfficeCode);
}

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
