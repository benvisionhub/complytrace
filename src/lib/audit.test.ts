import { describe, expect, it } from "vitest";
import { classifyRedaction, generateAuditReport, riskScore, summarizeTraces, type TraceEvent } from "./audit";

const base: TraceEvent = {
  id: "tr_demo_001",
  agentName: "KYC Review Copilot",
  workflow: "enhanced-diligence-summary",
  occurredAt: "2026-05-01T14:00:00.000Z",
  environment: "production-shadow",
  metadataOnly: true,
  rawPromptStored: false,
  customerDataStored: false,
  redactionClass: "metadata_only",
  modelProvider: "OpenRouter",
  modelName: "synthetic-demo-model",
  actionCategory: "case-summary",
  retentionDays: 180,
  policies: [
    { id: "pol_1", name: "No raw customer payload storage", status: "pass", evidence: "Only metadata hash references retained." },
  ],
  approvals: [{ reviewerRole: "Compliance lead", status: "approved", decidedAt: "2026-05-01T14:10:00.000Z", evidence: "Approved synthetic demo trace." }],
};

describe("audit domain functions", () => {
  it("classifies metadata-only traces as metadata_only", () => {
    expect(classifyRedaction(base)).toBe("metadata_only");
  });

  it("blocks events that attempt raw prompt or customer-data storage", () => {
    expect(classifyRedaction({ ...base, rawPromptStored: true })).toBe("blocked_sensitive_payload");
    expect(classifyRedaction({ ...base, customerDataStored: true })).toBe("blocked_sensitive_payload");
  });

  it("assigns materially higher risk for failed policies and sensitive storage", () => {
    const safeScore = riskScore(base);
    const riskyScore = riskScore({
      ...base,
      metadataOnly: false,
      rawPromptStored: true,
      customerDataStored: true,
      policies: [{ id: "pol_2", name: "Redaction required", status: "fail", evidence: "Payload field attempted." }],
    });
    expect(safeScore).toBeLessThan(20);
    expect(riskyScore).toBeGreaterThanOrEqual(90);
  });

  it("summarizes pass/warn/fail, approvals, and data minimization", () => {
    const events: TraceEvent[] = [
      base,
      { ...base, id: "tr_demo_002", policies: [{ id: "pol_3", name: "Retention", status: "warn", evidence: "Review in 30 days." }] },
      { ...base, id: "tr_demo_003", metadataOnly: false, policies: [{ id: "pol_4", name: "Payload guard", status: "fail", evidence: "Blocked." }] },
    ];
    expect(summarizeTraces(events)).toMatchObject({ total: 3, pass: 1, warn: 1, fail: 1, humanApproved: 3, metadataOnly: 2, noRawPrompts: 3 });
  });

  it("generates an audit report with evidence and minimization statement", () => {
    const report = generateAuditReport([base]);
    expect(report.title).toContain("ComplyTrace");
    expect(report.evidence.join(" ")).toContain("No raw customer payload storage");
    expect(report.dataMinimizationStatement).toContain("excludes raw prompts");
  });
});
