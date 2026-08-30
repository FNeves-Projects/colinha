const PARTY_STYLES: Record<string, { background: string; color: string }> = {
  NOVO: { background: "#fb7600", color: "#ffffff" },
  PL: { background: "#005fa3", color: "#ffffff" },
  PT: { background: "#e13939", color: "#ffffff" },
  PSDB: { background: "#005aaa", color: "#ffffff" },
  MDB: { background: "#005fa3", color: "#ffffff" },
  PRTB: { background: "#005fa3", color: "#ffffff" },
  REPUBLICANOS: { background: "#005fa3", color: "#ffffff" },
  PP: { background: "#0078d7", color: "#ffffff" },
  PSD: { background: "#f4c400", color: "#111827" },
  PDT: { background: "#e13939", color: "#ffffff" },
  PSB: { background: "#e13939", color: "#ffffff" },
  PSOL: { background: "#ffd447", color: "#111827" },
  PCdoB: { background: "#e13939", color: "#ffffff" },
  UNIAO: { background: "#005fa3", color: "#ffffff" },
  PODEMOS: { background: "#7b2cbf", color: "#ffffff" },
  AVANTE: { background: "#ff6b00", color: "#ffffff" },
  PRD: { background: "#111827", color: "#ffffff" },
  MOBILIZA: { background: "#111827", color: "#ffffff" },
};

export function partyStyleForAcronym(acronym: string | null | undefined) {
  const key = acronym?.trim().toUpperCase() ?? "";
  return PARTY_STYLES[key] ?? { background: "#edf0f5", color: "#344054" };
}

export function previewOfficeLabel(officeId: string, fallback: string) {
  const labels: Record<string, string> = {
    federal: "DEPUTADA FEDERAL",
    estadual: "DEPUTADO ESTADUAL",
    senador1: "SENADOR",
    senador2: "SENADOR",
    governador: "GOVERNADOR",
    presidente: "PRESIDENTE",
  };
  return labels[officeId] ?? fallback.toUpperCase();
}
