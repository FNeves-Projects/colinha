import { getSql, hasDatabase } from "./db";
import { TERESINHA } from "./offices";
import { normalizeSocialLinks } from "./social-links";
import { TERESINHA_SQ_CANDIDATE } from "./tse-urls";
import type { Candidate, CandidateSummary, SocialLink } from "./types";

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

function mapRow(row: CandidateRow, socials: SocialLink[] = []): Candidate {
  return {
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
    occupation: cleanStoredValue(row.occupation),
    education: cleanStoredValue(row.education),
    photoUrl: cleanStoredValue(row.photo_url),
    tseUrl: cleanStoredValue(row.tse_url),
    socials: normalizeSocialLinks(socials),
    assets: [],
    source: row.source,
    sourceUpdatedAt: row.source_updated_at,
  };
}

async function loadRelated(candidateId: string) {
  const sql = getSql();
  const socialRowsRaw = await sql.query(
    `SELECT platform, url, handle FROM candidate_social_links
      WHERE candidate_id = $1 ORDER BY platform, id`,
    [candidateId],
  );
  return {
    socials: socialRowsRaw as unknown as SocialLink[],
  };
}

function withFixedSlotIdentity(fromDb: Candidate): Candidate {
  return {
    ...fromDb,
    id: TERESINHA.id,
  };
}

export async function getLiveTeresinha(): Promise<Candidate> {
  const fromDb = await getCandidateBySqCandidate(TERESINHA_SQ_CANDIDATE);
  return fromDb ? withFixedSlotIdentity(fromDb) : TERESINHA;
}

async function getCandidateBySqCandidate(sqCandidate: string): Promise<Candidate | null> {
  if (!hasDatabase()) return null;
  const sql = getSql();
  const rows = await sql.query(
    `SELECT id::text, sq_candidate, election_year, uf, office_code, office_name,
            ballot_number, ballot_name, full_name, party_acronym, status,
            birth_date::text, occupation, education, photo_url, tse_url, source,
            source_updated_at::text
       FROM candidates WHERE sq_candidate = $1 LIMIT 1`,
    [sqCandidate],
  ) as CandidateRow[];
  const row = rows[0];
  if (!row) return null;
  const related = await loadRelated(row.id);
  return mapRow(row, related.socials);
}

export async function searchCandidates(input: {
  query: string;
  officeCode: number;
  uf: string;
  year: number;
}): Promise<CandidateSummary[]> {
  const query = input.query.trim();
  if (input.officeCode === 6 && (query === "3088" || /teresinha/i.test(query))) {
    return [await getLiveTeresinha()];
  }
  if (!hasDatabase()) return [];

  const sql = getSql();
  const numeric = /^\d+$/.test(query);
  const rows = await sql.query(
    `SELECT id::text, sq_candidate, election_year, uf, office_code, office_name,
            ballot_number, ballot_name, full_name, party_acronym, status,
            birth_date::text, occupation, education, photo_url, tse_url, source,
            source_updated_at::text
       FROM candidates
      WHERE election_year = $1
        AND uf = $2
        AND office_code = $3
        AND ($4::boolean
          AND ballot_number LIKE $5
          OR NOT $4::boolean
          AND (unaccent(ballot_name) ILIKE unaccent($6) OR unaccent(full_name) ILIKE unaccent($6)))
      ORDER BY
        CASE WHEN ballot_number = $7 THEN 0 ELSE 1 END,
        similarity(unaccent(ballot_name), unaccent($8)) DESC,
        ballot_name
      LIMIT 8`,
    [input.year, input.uf, input.officeCode, numeric, `${query}%`, `%${query}%`, query, query],
  ) as CandidateRow[];

  return rows.map((row) => mapRow(row));
}

export async function getCandidateById(id: string): Promise<Candidate | null> {
  if (id === TERESINHA.id || id === TERESINHA_SQ_CANDIDATE) {
    return getLiveTeresinha();
  }
  if (!hasDatabase()) return null;
  const sql = getSql();
  const rows = await sql.query(
    `SELECT id::text, sq_candidate, election_year, uf, office_code, office_name,
            ballot_number, ballot_name, full_name, party_acronym, status,
            birth_date::text, occupation, education, photo_url, tse_url, source,
            source_updated_at::text
       FROM candidates WHERE id::text = $1 LIMIT 1`,
    [id],
  ) as CandidateRow[];
  const row = rows[0];
  if (!row) return null;
  if (row.sq_candidate === TERESINHA_SQ_CANDIDATE) {
    const related = await loadRelated(row.id);
    return withFixedSlotIdentity(mapRow(row, related.socials));
  }
  const related = await loadRelated(row.id);
  return mapRow(row, related.socials);
}
