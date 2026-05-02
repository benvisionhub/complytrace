import { describe, expect, it } from "vitest";
import {
  ComplyTrace,
  InMemoryTraceStore,
  createComplianceTrace,
  redactSensitive,
  verifyHashChain,
  type CompliancePolicy,
} from "./index";

const piiPolicy: CompliancePolicy = {
  id: "pii-redaction",
  description: "Do not persist raw PII in trace evidence",
  evaluate: ({ redaction }) =>
    redaction.blockedFields.length > 0 || redaction.redactedFields.length > 0
      ? { decision: "escalate", reason: "Sensitive fields detected and handled", severity: "medium" }
      : { decision: "allow", reason: "No sensitive fields detected", severity: "low" },
};

describe("ComplyTrace SDK", () => {
  it("wraps an agent run and records start/model/tool/policy/end events without raw payloads", async () => {
    const store = new InMemoryTraceStore();
    const tracer = new ComplyTrace({
      app: "loan-underwriting-agent",
      environment: "production-shadow",
      dataMode: "metadata_only",
      policies: [piiPolicy],
      store,
    });

    const result = await tracer.trace("loan-review", async (trace) => {
      const model = await trace.modelCall("openrouter", "anthropic/claude-sonnet-4.5", {
        prompt: "Review SSN 123-45-6789 for applicant abeni@example.com",
        output: "Escalate due to missing proof of income",
        metadata: { tokenCount: 412 },
      });
      trace.toolCall("core-banking", "lookup_balance", { accountNumber: "000111222333", customerName: "Jane Doe" });
      trace.policyCheck("pii-redaction", { redaction: model.redaction });
      trace.humanApproval("credit_risk_reviewer", "approved", "JIRA-CR-42");
      return { decision: "escalated" };
    });

    expect(result.decision).toBe("escalated");
    const traces = await store.listTraces();
    expect(traces).toHaveLength(1);
    const audit = traces[0];
    expect(audit.trace.workflow).toBe("loan-review");
    expect(audit.trace.events.map((event) => event.type)).toEqual([
      "agent_run_started",
      "model_call_completed",
      "tool_call_completed",
      "policy_check_completed",
      "human_approval_completed",
      "agent_run_completed",
    ]);
    expect(JSON.stringify(audit)).not.toContain("123-45-6789");
    expect(JSON.stringify(audit)).not.toContain("abeni@example.com");
    expect(JSON.stringify(audit)).not.toContain("000111222333");
    expect(audit.report.traceSummary.riskLabel).toBe("medium");
    expect(audit.evidence.hashChainValid).toBe(true);
    expect(verifyHashChain(audit.evidence.events)).toEqual({ valid: true });
  });

  it("creates a tamper-evident hash chain and detects modified evidence", async () => {
    const store = new InMemoryTraceStore();
    const tracer = createComplianceTrace({ app: "refund-agent", environment: "sandbox", store });

    await tracer.trace("refund", async (trace) => {
      trace.toolCall("payments", "refund", { amount: 42, customerEmail: "buyer@example.com" });
      return "ok";
    });

    const [audit] = await store.listTraces();
    const tampered = audit.evidence.events.map((event) => ({ ...event }));
    tampered[1] = { ...tampered[1], summary: "changed after the fact" };
    expect(verifyHashChain(tampered)).toEqual({ valid: false, brokenAt: tampered[1].id });
  });

  it("supports manual traces for existing codebases and produces exportable audit packets", async () => {
    const trace = createComplianceTrace({ app: "kyc-agent", environment: "production" }).startTrace("kyc-screening", {
      subjectRef: "case_123",
      customerTier: "business",
    });
    trace.redaction("input", { name: "Ada Lovelace", email: "ada@example.com", notes: "VIP" });
    trace.policyCheck("kyc-human-review", {
      decision: "escalate",
      reason: "High value account requires manual review",
      severity: "high",
    });
    trace.finish("requires_review");

    const audit = await trace.toAuditPacket();
    expect(audit.trace.dataMode).toBe("metadata_only");
    expect(audit.report.policiesEvaluated).toContain("kyc-human-review");
    expect(audit.report.traceSummary.riskLabel).toMatch(/high|critical/);
    expect(audit.evidence.events.every((event) => event.hash.length === 64)).toBe(true);
    expect(JSON.stringify(audit)).not.toContain("ada@example.com");
  });

  it("redacts common secrets and exposes metadata about what was protected", () => {
    const redaction = redactSensitive({
      email: "person@example.com",
      ssn: "123-45-6789",
      card: "4242 4242 4242 4242",
      token: "sk-live-secret",
      safe: "ok",
    });

    expect(redaction.clean).toEqual({
      email: "[REDACTED:email]",
      ssn: "[REDACTED:ssn]",
      card: "[REDACTED:card]",
      token: "[REDACTED:secret]",
      safe: "ok",
    });
    expect(redaction.redactedFields).toEqual(["email", "ssn", "card", "token"]);
    expect(redaction.blockedFields).toEqual([]);
    expect(redaction.inputHash).toHaveLength(64);
  });
});
