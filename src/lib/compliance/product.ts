import {
  ComplyTrace,
  createComplianceTrace,
  type ComplianceAuditPacket,
  type ComplianceDecision,
  type CompliancePolicy,
  type RiskSeverity,
} from "@complytrace/sdk";

export const defaultFintechPolicies: CompliancePolicy[] = [
  {
    id: "ct-data-minimization",
    description: "Raw regulated customer payloads must not be stored in trace evidence.",
    evaluate: ({ redaction }) =>
      redaction.redactedFields.length > 0
        ? { decision: "escalate", reason: "Sensitive fields were detected and represented as hashes/redactions.", severity: "medium" }
        : { decision: "allow", reason: "No sensitive fields detected in traced payload metadata.", severity: "low" },
  },
  {
    id: "ct-human-review-for-money-movement",
    description: "Money movement, credit, fraud, and KYC actions require approval or escalation evidence.",
    evaluate: ({ metadata }) => {
      const category = String(metadata?.actionCategory ?? "");
      const requiresReview = /refund|payment|credit|loan|fraud|kyc|transfer/i.test(category);
      return requiresReview
        ? { decision: "escalate", reason: `${category || "This action"} requires human review evidence.`, severity: "high" }
        : { decision: "allow", reason: "Action category does not require review in default policy.", severity: "low" };
    },
  },
];

export type TraceSimulationInput = {
  app?: string;
  workflow?: string;
  environment?: "sandbox" | "staging" | "production-shadow" | "production";
  actionCategory?: string;
  modelProvider?: string;
  modelName?: string;
  prompt?: string;
  output?: string;
  toolName?: string;
  toolOperation?: string;
  toolInput?: unknown;
  humanApproval?: {
    reviewerRole: string;
    decision: "approved" | "rejected" | "pending";
    evidenceRef: string;
  };
  policyDecision?: ComplianceDecision;
  policySeverity?: RiskSeverity;
};

export async function simulateComplianceTrace(input: TraceSimulationInput = {}): Promise<ComplianceAuditPacket> {
  const tracer = createComplianceTrace({
    app: input.app ?? "refund-review-agent",
    environment: input.environment ?? "production-shadow",
    dataMode: "metadata_only",
    policies: defaultFintechPolicies,
    defaultMetadata: { product: "ComplyTrace", sdkVersion: "0.1.0" },
  });

  const trace = tracer.startTrace(input.workflow ?? "refund-policy-escalation", {
    actionCategory: input.actionCategory ?? "refund-review",
    subjectRef: "case_hash_demo_42",
  });

  const model = trace.modelCall(input.modelProvider ?? "openrouter", input.modelName ?? "anthropic/claude-sonnet-4.5", {
    prompt:
      input.prompt ??
      "Customer abeni@example.com asks for refund. Card 4242 4242 4242 4242 appears in pasted support note. Decide whether to escalate.",
    output: input.output ?? "Escalate refund request because amount exceeds policy threshold and support note contained sensitive data.",
    metadata: { tokenCount: 512, latencyMs: 1240 },
  });

  trace.toolCall(input.toolName ?? "payments", input.toolOperation ?? "refund_eligibility_lookup", input.toolInput ?? {
    customerEmail: "abeni@example.com",
    accountNumber: "000111222333",
    refundAmount: 1299,
    currency: "USD",
  });

  trace.policyCheck("ct-data-minimization", { redaction: model.redaction });
  trace.policyCheck("ct-human-review-for-money-movement", {
    decision: input.policyDecision ?? "escalate",
    reason: "Refund action exceeds auto-approval threshold and requires reviewer evidence.",
    severity: input.policySeverity ?? "high",
  });

  const approval = input.humanApproval ?? {
    reviewerRole: "ops_manager",
    decision: "approved" as const,
    evidenceRef: "JIRA-REFUND-42",
  };
  trace.humanApproval(approval.reviewerRole, approval.decision, approval.evidenceRef);
  trace.finish("refund escalated with metadata-only audit evidence");
  return trace.toAuditPacket();
}

export const demoComplianceAuditPacket = await simulateComplianceTrace();
export const demoComplianceTrace = demoComplianceAuditPacket.trace;
export const demoComplianceReport = demoComplianceAuditPacket.report;

export function createServerTracer() {
  return new ComplyTrace({
    app: "api-ingested-agent",
    environment: "production-shadow",
    dataMode: "metadata_only",
    policies: defaultFintechPolicies,
  });
}
