# ComplyTrace

Compliance-grade audit trails for regulated fintech AI agents — with metadata-only tracing, policy logs, redaction evidence, human approval records, and audit-ready evidence packs.

- **No customer financial data required**
- **No raw prompt storage by default**
- **Server-side OpenRouter and Supabase keys only**
- Independent project, not affiliated with or endorsed by JPMorgan Chase & Co.

## Local development

```bash
npm install
npm test
npm run lint
npm run typecheck
npm run build
npm run dev
```

## Environment variables

Required for full hosted functionality:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` (server-side only)
- `OPENROUTER_API_KEY` (server-side only)

## Supabase

Apply `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor or CLI, then optionally run the seed script after wiring a TS runner. The app falls back to static synthetic metadata if the table is not present.
