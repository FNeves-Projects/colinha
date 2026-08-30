ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS birthplace text;

CREATE TABLE IF NOT EXISTS candidate_proposals (
  id bigserial PRIMARY KEY,
  candidate_id bigint NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  tse_file_id text NOT NULL,
  title text NOT NULL,
  local_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, tse_file_id)
);

CREATE INDEX IF NOT EXISTS candidate_proposals_candidate_idx
  ON candidate_proposals (candidate_id);
