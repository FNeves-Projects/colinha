export type Office = {
  id: string;
  label: string;
  shortLabel: string;
  digits: number;
  code: number;
  jurisdiction: "SP" | "BR";
  fixed?: boolean;
};

export const OFFICES: Office[] = [
  { id: "federal", label: "Deputada Federal", shortLabel: "Federal", digits: 4, code: 6, jurisdiction: "SP", fixed: true },
  { id: "estadual", label: "Deputado Estadual", shortLabel: "Estadual", digits: 5, code: 7, jurisdiction: "SP" },
  { id: "senador1", label: "Senador — 1ª vaga", shortLabel: "Senador 1", digits: 3, code: 5, jurisdiction: "SP" },
  { id: "senador2", label: "Senador — 2ª vaga", shortLabel: "Senador 2", digits: 3, code: 5, jurisdiction: "SP" },
  { id: "governador", label: "Governador", shortLabel: "Governador", digits: 2, code: 3, jurisdiction: "SP" },
  { id: "presidente", label: "Presidente", shortLabel: "Presidente", digits: 2, code: 1, jurisdiction: "BR" },
];

export const TERESINHA: import("./types").Candidate = {
  id: "campaign-teresinha-neves-2026",
  sqCandidate: "campaign-teresinha-neves-2026",
  electionYear: 2026,
  uf: "SP",
  officeCode: 6,
  officeName: "Deputada Federal",
  ballotNumber: "3088",
  ballotName: "Teresinha Neves",
  fullName: "Teresinha Neves",
  partyAcronym: "NOVO",
  status: "Candidatura da campanha",
  birthDate: null,
  occupation: null,
  education: null,
  photoUrl: "/assets/teresinha-neves.jpg",
  tseUrl: null,
  socials: [],
  assets: [],
  source: "Campanha",
  sourceUpdatedAt: null,
};
