CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS candidates (
  id bigserial PRIMARY KEY,
  sq_candidate text NOT NULL UNIQUE,
  election_year smallint NOT NULL,
  uf text NOT NULL CHECK (uf IN ('SP', 'BR')),
  office_code integer NOT NULL,
  office_name text NOT NULL,
  ballot_number text NOT NULL,
  ballot_name text NOT NULL,
  full_name text NOT NULL,
  party_acronym text,
  party_number text,
  status text,
  status_detail text,
  birth_date date,
  occupation text,
  education text,
  gender text,
  race text,
  marital_status text,
  photo_url text,
  tse_url text,
  source text NOT NULL DEFAULT 'TSE' CHECK (source IN ('TSE', 'Campanha')),
  source_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS candidates_lookup_idx
  ON candidates (election_year, uf, office_code, ballot_number);
CREATE INDEX IF NOT EXISTS candidates_ballot_name_trgm_idx
  ON candidates USING gin (ballot_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS candidates_full_name_trgm_idx
  ON candidates USING gin (full_name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS candidate_social_links (
  id bigserial PRIMARY KEY,
  candidate_id bigint NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  platform text NOT NULL,
  url text NOT NULL,
  handle text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, url)
);

CREATE TABLE IF NOT EXISTS declared_assets (
  id bigserial PRIMARY KEY,
  candidate_id bigint NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  asset_type text NOT NULL,
  description text NOT NULL,
  value numeric(16,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS declared_assets_candidate_idx ON declared_assets (candidate_id);

CREATE TABLE IF NOT EXISTS sync_runs (
  id bigserial PRIMARY KEY,
  source text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  details jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

INSERT INTO candidates (
  sq_candidate, election_year, uf, office_code, office_name, ballot_number,
  ballot_name, full_name, party_acronym, status, photo_url, source
) VALUES (
  'campaign-teresinha-neves-2026', 2026, 'SP', 6, 'Deputada Federal', '3088',
  'Teresinha Neves', 'Teresinha Neves', 'NOVO', 'Candidatura da campanha',
  '/assets/teresinha-neves.jpg', 'Campanha'
)
ON CONFLICT (sq_candidate) DO UPDATE SET
  ballot_number = EXCLUDED.ballot_number,
  ballot_name = EXCLUDED.ballot_name,
  photo_url = EXCLUDED.photo_url,
  updated_at = now();
