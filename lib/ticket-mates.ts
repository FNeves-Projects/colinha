export const TICKET_MATE_OFFICE: Record<number, number> = {
  1: 2,
  3: 4,
};

export function ticketMateOfficeCode(headOfficeCode: number) {
  return TICKET_MATE_OFFICE[headOfficeCode] ?? null;
}

export function hasTicketMate(headOfficeCode: number) {
  return headOfficeCode in TICKET_MATE_OFFICE;
}

export function ticketMateRoleLabel(headOfficeCode: number) {
  if (headOfficeCode === 1) return "Vice-presidente";
  if (headOfficeCode === 3) return "Vice-governador";
  return "Vice";
}
