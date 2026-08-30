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
- After each CSV import, live fields such as **situação** are enriched from
  DivulgaCand (the CSV often ships `#NE` placeholders).
- Run the full local sync when Vercel cron is blocked:

```bash
npm run sync
```

Use `npm run sync -- --skip-photos` to refresh database fields only.
Use `npm run sync -- --skip-details` to skip nationality/proposal PDF sync.
Use `npm run sync:details` for profile fields and proposal PDFs alone.
Use `npm run sync:photos` for photos alone.
- The contingency snapshot is pinned to an auditable commit. It never replaces a
  newer TSE candidate photo already stored in Neon.
- Candidate photos must be loaded from official TSE photo ZIP files saved locally.
  Akamai blocks scripted downloads (HTTP 403), and some direct CDN URLs (for example
  `foto_cand2026_BR.zip` under `odsele/fotos`) return 404.
- Run `npm run sync:photos` on your machine (not on Vercel). It downloads the
  official SP/BR photo ZIPs from TSE, extracts JPEGs into `public/candidate-photos/`,
  and writes `/candidate-photos/{sq}.jpg` into `candidates.photo_url`. Cached ZIPs
  live in `data/tse-photos/`. Use `--local-only` to skip download, or `--force-download`
  to refresh the cache. Commit the generated files so Vercel can serve them on deploy.
- Party logos come from the Câmara Dados Abertos API. Run `npm run sync:party-logos`
  locally to refresh `public/party-logos/` and `lib/party-logos.generated.json`.
  Parties without an official logo file fall back to the colored acronym badge.
- Social links are shown as declared to the Brazilian Electoral Justice system.
- If TSE changes the file URLs, configure the `TSE_*_URL` variables in Vercel.

## Vercel

`vercel.json` schedules a daily sync, which is compatible with the Hobby plan.
For commercial or campaign production use, choose a plan that fits Vercel's terms
and increase the cron frequency if needed.

## Candidate photos

Photos are static files under `public/candidate-photos/` (~15 MB total). No external
storage or Vercel Blob is required on the Hobby plan.

From your computer:

```bash
npm run sync:photos
```

If automatic download fails, download **SP - Fotos de candidatos** from
https://dadosabertos.tse.jus.br/dataset/candidatos-2026 into `data/tse-photos/`
and run `npm run sync:photos -- --local-only`.

Then commit `public/candidate-photos/` and deploy. Re-run the command if TSE
publishes new candidate photos.

## Candidate proposals and profile fields

Nationality, birthplace, and proposal PDFs are fetched from DivulgaCand during
`npm run sync:details` (also included in full `npm run sync`). Like photos, this
must run on your machine — Vercel/datacenter IPs are often blocked by TSE.

PDFs are saved under `public/candidate-proposals/{tseFileId}.pdf` and metadata
is stored in Neon (`nationality`, `birthplace`, `candidate_proposals`). Commit
the generated PDFs and deploy so production can serve them as static files.

```bash
npm run db:migrate
npm run sync:details
```

Use `--limit=50` while testing. Re-run after deploy when TSE publishes updates.

## Post-Deploy Sync

The GitHub Actions workflow in `.github/workflows/sync-tse-after-deploy.yml`
calls `/api/sync/tse` after Vercel reports a successful production deployment.
It also supports manual runs from the GitHub Actions tab.

Create the same `CRON_SECRET` value in both places:

- Vercel project environment variables, scoped to Production.
- GitHub repository secret named `CRON_SECRET`.

If the current Vercel value cannot be revealed, rotate it by generating a new
random value and saving that same value in Vercel and GitHub.
