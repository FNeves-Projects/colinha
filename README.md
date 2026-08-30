# Colinha Digital 2026

Campaign web app for searching candidates, saving a voting cheat sheet as a PDF,
and sharing it through the phone's native share menu. Teresinha Neves (3088) is
fixed in the Federal Deputy slot; all other offices use candidate data imported
from TSE.

## Development

1. Copy `.env.example` to `.env.local` and set `DATABASE_URL` and `CRON_SECRET`.
2. Apply `sql/001_initial.sql` to an empty Postgres/Neon database with `npm run db:migrate`.
3. Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

## Data

- Voter selections stay only in `localStorage`.
- The API receives only the search term.
- The importer tries these sources in order: TSE Open Data ZIP/CSV files,
  DivulgaCand, and a pinned mirror snapshot of the original TSE CSV files.
- The contingency snapshot is pinned to an auditable commit. It never replaces a
  newer TSE candidate photo already stored in Neon.
- Candidate photos are first normalized to the TSE image endpoint and can then
  be copied to Vercel Blob. When `BLOB_READ_WRITE_TOKEN` is configured, each sync
  uploads a limited batch of photos to public Blob storage and updates
  `candidates.photo_url` with the Blob URL.
- `CANDIDATE_PHOTO_SYNC_LIMIT` controls the maximum number of photo uploads per
  sync run. The default is `200`; set it higher for a one-time backfill or `0` to
  disable Blob photo syncing while keeping candidate data sync enabled.
- Social links are shown as declared to the Brazilian Electoral Justice system.
- If TSE changes the file URLs, configure the `TSE_*_URL` variables in Vercel.

## Vercel

`vercel.json` schedules a daily sync, which is compatible with the Hobby plan.
For commercial or campaign production use, choose a plan that fits Vercel's terms
and increase the cron frequency if needed.

To store candidate photos in Vercel Blob:

1. Create a public Vercel Blob store in the same team as this project.
2. Connect the Blob store to the `colinha-digital` project.
3. Confirm that Vercel added `BLOB_READ_WRITE_TOKEN` to the project environment.
4. Run `/api/sync/tse` manually or wait for the scheduled/post-deploy sync.

The database stores only the resulting public Blob URL; image files are not saved
inside Postgres.

## Post-Deploy Sync

The GitHub Actions workflow in `.github/workflows/sync-tse-after-deploy.yml`
calls `/api/sync/tse` after Vercel reports a successful production deployment.
It also supports manual runs from the GitHub Actions tab.

Create the same `CRON_SECRET` value in both places:

- Vercel project environment variables, scoped to Production.
- GitHub repository secret named `CRON_SECRET`.

If the current Vercel value cannot be revealed, rotate it by generating a new
random value and saving that same value in Vercel and GitHub.
