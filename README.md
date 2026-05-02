# ComplyTrace

Compliance-grade audit trails for regulated fintech AI agents.

## What this MVP includes

- Next.js landing page and demo dashboard.
- Synthetic AI-agent trace explorer.
- Audit evidence report generated from metadata only.
- Supabase-backed waitlist and trace persistence API routes.
- OpenRouter-backed audit critique API route.
- Vitest coverage for core audit functions.

## Data posture

The demo does not use real customer data. The intended product default is metadata-only:

- no raw prompt storage by default
- no raw output storage by default
- no KYC documents
- no transaction payloads
- no customer financial records
- hashes, policy IDs, redaction classes, model metadata, and approval records only

## Environment variables

Required for full deployment:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
OPENROUTER_API_KEY=
NEXT_PUBLIC_APP_URL=
```

Optional:

```bash
SUPABASE_PUBLISHABLE_DEFAULT_KEY=
```

## Supabase schema

Apply:

```sql
supabase/migrations/001_initial_schema.sql
```

The API routes are resilient: if tables are missing, they return a schema warning instead of breaking the demo.

## Development

```bash
npm install
npm test
npm run lint
npm run typecheck
npm run build
npm run dev
```

## Disclaimer

Independent project. Not affiliated with or endorsed by JPMorgan Chase & Co.
