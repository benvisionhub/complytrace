# ComplyTrace

Compliance-grade audit trails for regulated fintech AI agents.

## What this MVP includes

- Installable `@complytrace/sdk` TypeScript package under `packages/complytrace`.
- Real trace wrapper for agent runs: model calls, tool calls, policy checks, approvals, failures.
- Built-in redaction for emails, SSNs, cards/account numbers, and API tokens before storage.
- Tamper-evident evidence hash chain with verification.
- Audit packet generator: risk score, evidence checklist, recommended actions, data-minimization statement.
- Next.js landing page and demo dashboard powered by a generated SDK audit packet.
- `/api/traces` endpoint that accepts trace simulation input, returns an audit packet, and persists it to Supabase when configured.
- `/api/ai/audit-critique` OpenRouter-backed critique endpoint with deterministic fallback.
- Supabase migration for waitlist and agent audit packets.

## SDK local development

```bash
npm install
npm test
npm run build:sdk
```

Use the library:

```ts
import { createComplianceTrace } from "@complytrace/sdk";

const ct = createComplianceTrace({ app: "refund-agent", environment: "production-shadow" });
await ct.trace("refund-review", async (trace) => {
  const model = trace.modelCall("openrouter", "anthropic/claude-sonnet", { prompt, output });
  trace.toolCall("payments", "refund_lookup", toolInput);
  trace.policyCheck("human-review", { decision: "escalate", reason: "Refund threshold exceeded", severity: "high" });
  trace.humanApproval("ops_manager", "approved", "JIRA-42");
});
```

## API trace ingestion

```bash
curl -X POST http://localhost:3000/api/traces \
  -H 'content-type: application/json' \
  -d '{"workflow":"refund-review","prompt":"customer abeni@example.com card 4242 4242 4242 4242","actionCategory":"refund"}'
```

The response includes `packet.trace`, `packet.evidence.rootHash`, hash-chain events, and audit report.

## Environment

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
