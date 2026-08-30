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
