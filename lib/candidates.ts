import { getSql, hasDatabase } from "./db";
import { officeHasGovernmentPlan, resolveStoredProposalUrl } from "./divulga-proposals";
import {
  applyTeresinhaSlotIdentity,
  isTeresinhaCandidate,
  TERESINHA_ID,
} from "./teresinha-slot";
import { normalizeSocialLinks } from "./social-links";
import { hasTicketSlate, slateMateOfficeCodes, ticketHeadOfficeCode, ticketHeadOfficeCodeFor } from "./ticket-mates";
import { TERESINHA_SQ_CANDIDATE } from "./tse-urls";
import type { Candidate, CandidateProposal, CandidateSummary, DeclaredAsset, SocialLink } from "./types";

type CandidateRow = {
  id: string;
  sq_candidate: string;
  election_year: number;
  uf: string;
  office_code: number;
  office_name: string;
  ballot_number: string;
  ballot_name: string;
  full_name: string;
  party_acronym: string | null;
  status: string | null;
  birth_date: string | null;
  gender: string | null;
  marital_status: string | null;
  nationality: string | null;
  birthplace: string | null;
  occupation: string | null;
  education: string | null;
  photo_url: string | null;
  tse_url: string | null;
  source: "TSE" | "Campanha";
  source_updated_at: string | null;
};

function cleanStoredValue(value: string | null) {
  const clean = value?.trim();
  return clean && !["#NULO#", "#NE", "-1"].includes(clean) ? clean : null;
}

type CandidateRelations = {
  socials: SocialLink[];
  assets: DeclaredAsset[];
  proposals?: CandidateProposal[];
};

function mapAssetRows(rows: Array<{ asset_type: string; description: string; value: number | string }>): DeclaredAsset[] {
  return rows.map((row) => ({
    type: row.asset_type.trim() || "Bem declarado",
    description: row.description.trim() || "Sem descrição",
    value: Number(row.value) || 0,
  }));
}

function mapRow(row: CandidateRow, related: CandidateRelations = { socials: [], assets: [] }): Candidate {
  return applyTeresinhaSlotIdentity({
    id: String(row.id),
    sqCandidate: row.sq_candidate,
    electionYear: row.election_year,
    uf: row.uf,
    officeCode: row.office_code,
    officeName: row.office_name,
    ballotNumber: row.ballot_number,
    ballotName: row.ballot_name,
    fullName: row.full_name,
    partyAcronym: cleanStoredValue(row.party_acronym),
    status: cleanStoredValue(row.status),
    birthDate: row.birth_date,
    gender: cleanStoredValue(row.gender),
    maritalStatus: cleanStoredValue(row.marital_status),
    nationality: cleanStoredValue(row.nationality),
    birthplace: cleanStoredValue(row.birthplace),
    occupation: cleanStoredValue(row.occupation),
    education: cleanStoredValue(row.education),
    photoUrl: cleanStoredValue(row.photo_url),
    tseUrl: cleanStoredValue(row.tse_url),
    socials: normalizeSocialLinks(related.socials),
    assets: related.assets,
    source: row.source,
    sourceUpdatedAt: row.source_updated_at,
    proposals: related.proposals,
  });
}

async function loadRelated(candidateId: string, options?: { includeProposals?: boolean }) {
  const sql = getSql();
  const socialRowsRaw = await sql.query(
    `SELECT platform, url, handle FROM candidate_social_links
      WHERE candidate_id = $1 ORDER BY platform, id`,
    [candidateId],
  );
  const assetRowsRaw = await sql.query(
    `SELECT asset_type, description, value::float8 AS value
       FROM declared_assets
      WHERE candidate_id = $1
      ORDER BY value DESC, id`,
    [candidateId],
  ) as Array<{ asset_type: string; description: string; value: number | string }>;
  const assets = mapAssetRows(assetRowsRaw);

  if (!options?.includeProposals) {
    return {
      socials: socialRowsRaw as unknown as SocialLink[],
      assets,
    };
  }

  const proposalRowsRaw = await sql.query(
    `SELECT tse_file_id, title, local_url
       FROM candidate_proposals
      WHERE candidate_id = $1
      ORDER BY id`,
    [candidateId],
  ) as Array<{ tse_file_id: string; title: string; local_url: string | null }>;

  const proposals = proposalRowsRaw.map((proposal) => ({
    id: proposal.tse_file_id,
    title: proposal.title,
    url: resolveStoredProposalUrl(proposal.tse_file_id, proposal.local_url),
  }));

  return {
    socials: socialRowsRaw as unknown as SocialLink[],
    assets,
    proposals,
  };
}

export function candidateProfileLookupId(summary: Pick<CandidateSummary, "id" | "sqCandidate">) {
  return isTeresinhaCandidate(summary) ? TERESINHA_ID : summary.id;
}

export function candidateFromSummary(summary: CandidateSummary): Candidate {
  const extended = summary as Partial<Candidate>;
  return {
    ...summary,
    electionYear: extended.electionYear ?? 2026,
    birthDate: extended.birthDate ?? null,
    gender: extended.gender ?? null,
    maritalStatus: extended.maritalStatus ?? null,
    nationality: extended.nationality ?? null,
    birthplace: extended.birthplace ?? null,
    occupation: extended.occupation ?? null,
    education: extended.education ?? null,
    tseUrl: extended.tseUrl ?? null,
    socials: extended.socials ?? [],
    assets: extended.assets ?? [],
    sourceUpdatedAt: extended.sourceUpdatedAt ?? null,
    proposals: extended.proposals,
  };
}

async function hydrateCandidateDetails(candidate: Candidate): Promise<Candidate> {
  if (typeof window !== "undefined") return candidate;

  const { candidateNeedsLiveEnrichment, fetchCandidateLiveBundle, mergeCandidateLiveBundle } = await import(
    "./candidate-live-details"
  );
  if (!candidateNeedsLiveEnrichment(candidate)) return candidate;
  const bundle = await fetchCandidateLiveBundle({
    sqCandidate: candidate.sqCandidate,
    uf: candidate.uf,
    officeCode: candidate.officeCode,
  });
  return mergeCandidateLiveBundle(candidate, bundle);
}

export async function listPartiesForOffice(input: {
  officeCode: number;
  uf: string;
  year: number;
}): Promise<string[]> {
  if (!hasDatabase()) return [];
  const sql = getSql();
  const rows = await sql.query(
    `SELECT DISTINCT party_acronym
       FROM candidates
      WHERE election_year = $1
        AND uf = $2
        AND office_code = $3
        AND party_acronym IS NOT NULL
        AND btrim(party_acronym) <> ''
      ORDER BY party_acronym`,
    [input.year, input.uf, input.officeCode],
  ) as Array<{ party_acronym: string }>;
  return rows.map((row) => row.party_acronym.trim()).filter(Boolean);
}

export async function searchCandidates(input: {
  query?: string;
  officeCode: number;
  uf: string;
  year: number;
  party?: string;
  limit?: number;
}): Promise<CandidateSummary[]> {
  const query = input.query?.trim() ?? "";
  const limit = input.limit ?? (query ? 8 : 20);
  const party = input.party?.trim() || null;

  if (!hasDatabase()) return [];

  const sql = getSql();
  const candidateSelect = `SELECT id::text, sq_candidate, election_year, uf, office_code, office_name,
            ballot_number, ballot_name, full_name, party_acronym, status,
            birth_date::text, occupation, education, photo_url, tse_url, source,
            source_updated_at::text`;

  if (!query) {
    const rows = await sql.query(
      `${candidateSelect}
         FROM candidates
        WHERE election_year = $1
          AND uf = $2
          AND office_code = $3
          AND ($4::text IS NULL OR party_acronym = $4)
        ORDER BY ballot_name
        LIMIT $5`,
      [input.year, input.uf, input.officeCode, party, limit],
    ) as CandidateRow[];
    return rows.map((row) => mapRow(row));
  }

  const numeric = /^\d+$/.test(query);
  const rows = await sql.query(
    `${candidateSelect}
       FROM candidates
      WHERE election_year = $1
        AND uf = $2
        AND office_code = $3
        AND ($4::text IS NULL OR party_acronym = $4)
        AND ($5::boolean
          AND ballot_number LIKE $6
          OR NOT $5::boolean
          AND (unaccent(ballot_name) ILIKE unaccent($7) OR unaccent(full_name) ILIKE unaccent($7)))
      ORDER BY
        CASE WHEN ballot_number = $8 THEN 0 ELSE 1 END,
        similarity(unaccent(ballot_name), unaccent($9)) DESC,
        ballot_name
      LIMIT $10`,
    [
      input.year,
      input.uf,
      input.officeCode,
      party,
      numeric,
      `${query}%`,
      `%${query}%`,
      query,
      query,
      limit,
    ],
  ) as CandidateRow[];

  return rows.map((row) => mapRow(row));
}

export async function getTicketSlateForHead(input: {
  headOfficeCode: number;
  ballotNumber: string;
  uf: string;
  year: number;
}): Promise<CandidateSummary[]> {
  const mateOfficeCodes = slateMateOfficeCodes(input.headOfficeCode);
  if (!mateOfficeCodes.length || !hasDatabase()) return [];

  const sql = getSql();
  const rows = await sql.query(
    `SELECT id::text, sq_candidate, election_year, uf, office_code, office_name,
            ballot_number, ballot_name, full_name, party_acronym, status,
            birth_date::text, occupation, education, photo_url, tse_url, source,
            source_updated_at::text
       FROM candidates
      WHERE election_year = $1
        AND uf = $2
        AND office_code = ANY($3::int[])
        AND ltrim(ballot_number, '0') = ltrim($4, '0')
      ORDER BY office_code`,
    [input.year, input.uf, mateOfficeCodes, input.ballotNumber],
  ) as CandidateRow[];

  return rows.map((row) => mapRow(row));
}

export async function getTicketHeadForMate(input: {
  mateOfficeCode: number;
  ballotNumber: string;
  uf: string;
  year: number;
}): Promise<CandidateSummary | null> {
  const headOfficeCode = ticketHeadOfficeCode(input.mateOfficeCode);
  if (!headOfficeCode || !hasDatabase()) return null;

  const sql = getSql();
  const rows = await sql.query(
    `SELECT id::text, sq_candidate, election_year, uf, office_code, office_name,
            ballot_number, ballot_name, full_name, party_acronym, status,
            birth_date::text, occupation, education, photo_url, tse_url, source,
            source_updated_at::text
       FROM candidates
      WHERE election_year = $1
        AND uf = $2
        AND office_code = $3
        AND ltrim(ballot_number, '0') = ltrim($4, '0')
      LIMIT 1`,
    [input.year, input.uf, headOfficeCode, input.ballotNumber],
  ) as CandidateRow[];

  const row = rows[0];
  return row ? mapRow(row) : null;
}

export async function getTicketChapaForCandidate(input: {
  officeCode: number;
  candidateId: string;
  ballotNumber: string;
  uf: string;
  year: number;
}): Promise<CandidateSummary[]> {
  const headOfficeCode = ticketHeadOfficeCodeFor(input.officeCode);
  if (!headOfficeCode || !hasDatabase()) return [];

  const mates = await getTicketSlateForHead({
    headOfficeCode,
    ballotNumber: input.ballotNumber,
    uf: input.uf,
    year: input.year,
  });

  if (hasTicketSlate(input.officeCode)) {
    return mates;
  }

  const head = await getTicketHeadForMate({
    mateOfficeCode: input.officeCode,
    ballotNumber: input.ballotNumber,
    uf: input.uf,
    year: input.year,
  });

  return [
    ...(head ? [head] : []),
    ...mates.filter((mate) => mate.id !== input.candidateId),
  ].filter((member, index, members) => members.findIndex((entry) => entry.id === member.id) === index);
}

export async function getTicketMateForHead(input: {
  headOfficeCode: number;
  ballotNumber: string;
  uf: string;
  year: number;
}): Promise<CandidateSummary | null> {
  const slate = await getTicketSlateForHead(input);
  return slate[0] ?? null;
}

export async function getCandidateById(id: string): Promise<Candidate | null> {
  if (!hasDatabase()) return null;

  const lookupKey = id === TERESINHA_ID || id === TERESINHA_SQ_CANDIDATE
    ? TERESINHA_SQ_CANDIDATE
    : id;

  const sql = getSql();
  const rows = await sql.query(
    `SELECT id::text, sq_candidate, election_year, uf, office_code, office_name,
            ballot_number, ballot_name, full_name, party_acronym, status,
            birth_date::text, gender, marital_status, nationality, birthplace,
            occupation, education, photo_url, tse_url, source,
            source_updated_at::text
       FROM candidates
      WHERE id::text = $1 OR sq_candidate = $1
      LIMIT 1`,
    [lookupKey],
  ) as CandidateRow[];
  const row = rows[0];
  if (!row) return null;
  const includeProposals = officeHasGovernmentPlan(row.office_code);
  const related = await loadRelated(row.id, { includeProposals });
  const candidate = mapRow(row, {
    ...related,
    proposals: includeProposals ? related.proposals : [],
    assets: related.assets,
  });
  return hydrateCandidateDetails(candidate);
}
