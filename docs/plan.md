# ComplyTrace MVP plan

## Goal
Build a production-looking MVP for **ComplyTrace**, a metadata-only compliance audit trail product for regulated fintech AI agents. The app must demonstrate value without storing customer financial data, raw prompts, or confidential payloads.

## Initial plan
1. Scaffold a Next.js/TypeScript app for Vercel.
2. Model synthetic trace metadata: agent action, policy checks, redaction evidence, approvals, and retention state.
3. Create pure domain functions for risk scoring, redaction classification, trace summaries, and audit reports, with tests first.
4. Add server-side integrations:
   - Supabase persistence for waitlist/demo trace metadata.
   - OpenRouter endpoint for audit-summary critique using synthetic metadata only.
5. Build pages: landing, demo dashboard, trace explorer, audit report, pricing/waitlist CTA, disclaimers.
6. Deploy on Vercel, run browser QA, critique, improve, redeploy.

## Critique of the plan
- Risk: a generic dashboard could look like a toy. Mitigation: include regulator/auditor-oriented language, evidence-pack structure, and controls checklist.
- Risk: accidental data collection. Mitigation: explicit copy, schema constraints oriented around metadata, server-side allow-listed fields, no raw prompt/customer payload fields.
- Risk: Supabase DDL may be unavailable from the environment. Mitigation: include migration SQL and a seed script; app gracefully falls back to static synthetic traces if tables are absent.
- Risk: LLM feature could leak sensitive data if users paste it. Mitigation: endpoint uses fixed synthetic metadata and a strict system prompt; UI explains not to submit confidential data.

## Refined build approach
- Make the demo valuable even if external persistence setup is partially blocked.
- Treat OpenRouter as an enhancement; return a deterministic local critique fallback if unavailable.
- Make QA-driven improvements after deployment: copy clarity, form behavior, console errors, mobile layout.
