import { describe, expect, it } from "vitest";
import {
  classifyRedactionPosture,
  createAuditReport,
  scoreTraceRisk,
  summarizeTrace,
  type AgentTrace,
} from "../audit";

const baseTrace: AgentTrace = {
  id: "trace_demo_001",
  agentName: "refund_review_agent",
  environment: "staging",
  startedAt: "2026-05-02T08:00:00.000Z",
  completedAt: "2026-05-02T08:04:00.000Z",
  dataMode: "metadata_only",
  events: [
    {
      id: "evt_1",
      type: "agent_run_started",
      timestamp: "2026-05-02T08:00:00.000Z",
      summary: "Refund review agent started",
      severity: "info",
    },
    {
      id: "evt_2",
      type: "redaction_completed",
      timestamp: "2026-05-02T08:00:03.000Z",
      summary: "Detected and redacted PII before model call",
      severity: "success",
      piiDetected: 2,
      redacted: true,
    },
    {
      id: "evt_3",
      type: "model_call_completed",
      timestamp: "2026-05-02T08:00:10.000Z",
      summary: "Generated refund recommendation from hashed prompt/output",
      severity: "info",
      model: "openrouter/anthropic/claude-sonnet-4.5",
      promptHash: "sha256:abc",
      outputHash: "sha256:def",
    },
    {
      id: "evt_4",
      type: "policy_check_completed",
      timestamp: "2026-05-02T08:00:15.000Z",
      summary: "Refund exceeded auto-approval threshold",
      severity: "warning",
      policyId: "refund_policy_v1",
      policyDecision: "escalate",
    },
    {
      id: "evt_5",
      type: "human_approval_completed",
      timestamp: "2026-05-02T08:03:59.000Z",
      summary: "Ops manager approved the recommendation",
      severity: "success",
      reviewer: "ops_manager_hash",
    },
  ],
};

describe("audit domain logic", () => {
  it("classifies redaction posture as protected when PII is detected and redacted", () => {
    expect(classifyRedactionPosture(baseTrace)).toBe("protected");
  });

  it("scores risk based on escalations, missing approvals, and redaction failures", () => {
    expect(scoreTraceRisk(baseTrace)).toEqual({ score: 35, label: "medium" });

    const riskyTrace: AgentTrace = {
      ...baseTrace,
      events: baseTrace.events.filter((event) => event.type !== "human_approval_completed").map((event) =>
        event.type === "redaction_completed" ? { ...event, redacted: false, severity: "critical" } : event,
      ),
    };

    expect(scoreTraceRisk(riskyTrace)).toEqual({ score: 95, label: "critical" });
  });

  it("summarizes traces with counts and compliance posture", () => {
    expect(summarizeTrace(baseTrace)).toMatchObject({
      traceId: "trace_demo_001",
      agentName: "refund_review_agent",
      dataMode: "metadata_only",
      totalEvents: 5,
      modelCalls: 1,
      toolCalls: 0,
      policyChecks: 1,
      escalations: 1,
      humanApprovals: 1,
      redactionPosture: "protected",
    });
  });

  it("creates an audit report with executive summary and evidence checklist", () => {
    const report = createAuditReport(baseTrace);

    expect(report.executiveSummary).toContain("refund_review_agent");
    expect(report.evidenceChecklist).toContain("Prompt/output hashes captured");
    expect(report.evidenceChecklist).toContain("Human approval recorded");
    expect(report.recommendedActions).toContain("Review escalation threshold tuning for refund_policy_v1.");
  });
});
