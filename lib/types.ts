export type SocialLink = {
  platform: string;
  url: string;
  handle?: string | null;
};

export type DeclaredAsset = {
  type: string;
  description: string;
  value: number;
};

export type CandidateProposal = {
  id: string;
  title: string;
  url: string;
};

export type Candidate = {
  id: string;
  sqCandidate: string;
  electionYear: number;
  uf: string;
  officeCode: number;
  officeName: string;
  ballotNumber: string;
  ballotName: string;
  fullName: string;
  partyAcronym: string | null;
  status: string | null;
  birthDate: string | null;
  gender: string | null;
  maritalStatus: string | null;
  nationality: string | null;
  birthplace: string | null;
  occupation: string | null;
  education: string | null;
  photoUrl: string | null;
  tseUrl: string | null;
  socials: SocialLink[];
  assets: DeclaredAsset[];
  source: "TSE" | "Campanha";
  sourceUpdatedAt: string | null;
  proposals?: CandidateProposal[];
};

export type CandidateSummary = Pick<
  Candidate,
  | "id"
  | "sqCandidate"
  | "officeCode"
  | "officeName"
  | "ballotNumber"
  | "ballotName"
  | "fullName"
  | "partyAcronym"
  | "status"
  | "photoUrl"
  | "uf"
  | "source"
>;
