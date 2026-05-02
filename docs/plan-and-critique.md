# ComplyTrace Build Plan + Self-Critique

## Product Thesis

ComplyTrace is a compliance-grade audit trail layer for fintech AI agents. It helps regulated teams prove what an agent did without storing customer financial data by default.

## MVP Scope

- Public landing page explaining the product and trust posture.
- Demo dashboard showing synthetic AI agent traces.
- Trace explorer with timeline of model calls, tool calls, policy checks, redactions, and approvals.
- Audit report page summarizing risk, evidence, redactions, and human approvals.
- Supabase-backed waitlist endpoint.
- Supabase-backed trace ingestion endpoint for demo traces.
- OpenRouter-powered audit critique endpoint using only synthetic/metadata trace summaries.
- Tests for pure core logic: risk scoring, redaction classification, trace summarization, and audit report generation.

## Data Boundary

Default product posture:

- Do not store raw prompts.
- Do not store raw outputs.
- Store hashes, model metadata, tool metadata, policy decisions, data classification, redaction status, and approval trail.
- Use synthetic sample data in the demo.
- Keep OpenRouter and Supabase service keys server-side only.

## Architecture

- Next.js App Router frontend and API routes.
- TypeScript domain modules in `src/lib/audit`.
- Static synthetic demo data in `src/lib/demo-data.ts`.
- Supabase server client in `src/lib/supabase/server.ts`.
- API routes:
  - `POST /api/waitlist`
  - `POST /api/traces`
  - `POST /api/ai/audit-critique`
- SQL migration in `supabase/migrations/001_initial_schema.sql`.

## First Self-Critique

Risk: The product could feel too abstract if it only shows logs.

Mitigation: Make the demo tell a concrete story: a refund-review agent escalates due to policy threshold, redacts PII, records human approval, then emits an audit report.

Risk: The market already has LLM observability tools.

Mitigation: Position away from debugging and toward compliance evidence: policy decisions, redaction posture, human approvals, audit exports, and low-data adoption.

Risk: Supabase DDL may not be possible from available env variables.

Mitigation: Include migration SQL and implement runtime API routes that gracefully report missing tables. Use server-side service key only.

Risk: Using JPMorgan in copy could create compliance/IP issues.

Mitigation: Use only a small independent-project disclaimer and avoid claiming affiliation/endorsement.

## Iteration Plan

1. Build tested core audit logic.
2. Build polished landing/demo UI.
3. Add Supabase and OpenRouter API routes.
4. Run tests/build/lint.
5. Deploy to Vercel.
6. Browser QA.
7. Critique UI/API based on QA.
8. Improve copy, navigation, states, and any errors.
9. Redeploy.
