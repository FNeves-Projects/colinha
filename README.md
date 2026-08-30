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
- Social links are shown as declared to the Brazilian Electoral Justice system.
- If TSE changes the file URLs, configure the `TSE_*_URL` variables in Vercel.

## Vercel

`vercel.json` schedules a daily sync, which is compatible with the Hobby plan.
For commercial or campaign production use, choose a plan that fits Vercel's terms
and increase the cron frequency if needed.
