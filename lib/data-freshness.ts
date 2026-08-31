import { getSql, hasDatabase } from "./db";

export const TSE_DIVULGA_HOME_URL = "https://divulgacandcontas.tse.jus.br/divulga/";

export type DataFreshness = {
  lastSyncAt: string | null;
  dataUpdatedAt: string | null;
  candidateCount: number;
};

export async function getDataFreshness(): Promise<DataFreshness | null> {
  if (!hasDatabase()) return null;

  const sql = getSql();
  const rows = await sql.query(
    `SELECT
       (
         SELECT finished_at::text
           FROM sync_runs
          WHERE source = 'TSE'
            AND status = 'success'
            AND finished_at IS NOT NULL
          ORDER BY finished_at DESC
          LIMIT 1
       ) AS last_sync_at,
       (
         SELECT max(COALESCE(source_updated_at, updated_at))::text
           FROM candidates
          WHERE election_year = 2026
            AND uf IN ('SP', 'BR')
       ) AS data_updated_at,
       (
         SELECT count(*)::int
           FROM candidates
          WHERE election_year = 2026
            AND uf IN ('SP', 'BR')
       ) AS candidate_count`,
  ) as Array<{
    last_sync_at: string | null;
    data_updated_at: string | null;
    candidate_count: number;
  }>;

  const row = rows[0];
  if (!row) return null;

  return {
    lastSyncAt: row.last_sync_at,
    dataUpdatedAt: row.data_updated_at,
    candidateCount: row.candidate_count ?? 0,
  };
}

export function dataFreshnessInstant(freshness: DataFreshness | null | undefined) {
  if (!freshness) return null;
  return freshness.lastSyncAt ?? freshness.dataUpdatedAt;
}

export function formatDataFreshnessLabel(freshness: DataFreshness | null | undefined) {
  const instant = dataFreshnessInstant(freshness);
  if (!instant) return null;

  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return null;

  const formatted = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);

  return `Dados do TSE atualizados em ${formatted}.`;
}
