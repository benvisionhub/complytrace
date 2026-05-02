# @complytrace/sdk

Installable TypeScript SDK for compliance-grade AI agent tracing.

## What it does

- Wraps an agent run with `trace()` or manual `startTrace()`.
- Records model calls, tool calls, policy decisions, redaction evidence, human approvals, and run completion/failure.
- Redacts common regulated/secrets data before storage: emails, SSNs, cards/account numbers, API keys/tokens.
- Stores cryptographic hashes for payload references instead of raw customer data.
- Builds a tamper-evident hash chain over trace events.
- Produces an audit packet with risk score, checklist, recommendations, and data minimization statement.

## Usage

```ts
import { createComplianceTrace } from "@complytrace/sdk";

const ct = createComplianceTrace({
  app: "refund-agent",
  environment: "production-shadow",
});

await ct.trace("refund-review", async (trace) => {
  const model = trace.modelCall("openrouter", "anthropic/claude-sonnet", {
    prompt,
    output,
  });

  trace.toolCall("payments", "refund_lookup", toolInput);
  trace.policyCheck("pii-redaction", {
    decision: model.redaction.redactedFields.length ? "escalate" : "allow",
    reason: "Sensitive fields handled before evidence storage",
    severity: "medium",
  });
  trace.humanApproval("ops_manager", "approved", "JIRA-42");
});
```

## Manual audit packet

```ts
const trace = ct.startTrace("kyc-review", { subjectRef: "case_hash_123" });
trace.redaction("input", customerPayload);
trace.policyCheck("human-review", {
  decision: "escalate",
  reason: "High-risk KYC case",
  severity: "high",
});
trace.finish("requires review");
const packet = await trace.toAuditPacket();
```

## Verify evidence

```ts
import { verifyHashChain } from "@complytrace/sdk";
const result = verifyHashChain(packet.evidence.events);
```
