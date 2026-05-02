export type PolicyStatus = "pass" | "warn" | "fail";
export type ApprovalStatus = "approved" | "pending" | "rejected";
export type RedactionClass = "none" | "metadata_only" | "redacted_reference" | "blocked_sensitive_payload";

export type PolicyCheck = {
  id: string;
  name: string;
  status: PolicyStatus;
  evidence: string;
};

export type HumanApproval = {
  reviewerRole: string;
  status: ApprovalStatus;
  decidedAt?: string;
  evidence: string;
};

export type TraceEvent = {
  id: string;
  agentName: string;
  workflow: string;
  occurredAt: string;
  environment: "sandbox" | "production-shadow" | "production";
  metadataOnly: boolean;
  rawPromptStored: boolean;
  customerDataStored: boolean;
  redactionClass: RedactionClass;
  policies: PolicyCheck[];
  approvals: HumanApproval[];
  retentionDays: number;
  modelProvider: string;
  modelName: string;
  actionCategory: string;
};

export type TraceSummary = {
  total: number;
  pass: number;
  warn: number;
  fail: number;
  humanApproved: number;
  metadataOnly: number;
  noRawPrompts: number;
};

export function classifyRedaction(event: Pick<TraceEvent, "metadataOnly" | "rawPromptStored" | "customerDataStored" | "redactionClass">) {
  if (event.rawPromptStored || event.customerDataStored) return "blocked_sensitive_payload" satisfies RedactionClass;
  if (event.redactionClass === "redacted_reference") return "redacted_reference" satisfies RedactionClass;
  return event.metadataOnly ? "metadata_only" : "none";
}

export function riskScore(event: TraceEvent): number {
  let score = 10;
  score += event.policies.filter((p) => p.status === "warn").length * 15;
  score += event.policies.filter((p) => p.status === "fail").length * 35;
  score += event.approvals.some((a) => a.status === "pending") ? 15 : 0;
  score += event.approvals.some((a) => a.status === "rejected") ? 35 : 0;
  score += event.rawPromptStored ? 40 : 0;
  score += event.customerDataStored ? 50 : 0;
  score += event.metadataOnly ? -8 : 10;
  score += event.retentionDays > 365 ? 10 : 0;
  return Math.max(0, Math.min(100, score));
}

export function summarizeTraces(events: TraceEvent[]): TraceSummary {
  return events.reduce(
    (acc, event) => {
      acc.total += 1;
      if (event.policies.every((p) => p.status === "pass")) acc.pass += 1;
      if (event.policies.some((p) => p.status === "warn")) acc.warn += 1;
      if (event.policies.some((p) => p.status === "fail")) acc.fail += 1;
      if (event.approvals.some((a) => a.status === "approved")) acc.humanApproved += 1;
      if (event.metadataOnly) acc.metadataOnly += 1;
      if (!event.rawPromptStored) acc.noRawPrompts += 1;
      return acc;
    },
    { total: 0, pass: 0, warn: 0, fail: 0, humanApproved: 0, metadataOnly: 0, noRawPrompts: 0 } as TraceSummary,
  );
}

export function generateAuditReport(events: TraceEvent[]) {
  const summary = summarizeTraces(events);
  const highRisk = events.filter((event) => riskScore(event) >= 60);
  const evidence = events.flatMap((event) => [
    `${event.id}: ${event.agentName} / ${event.workflow}`,
    ...event.policies.map((p) => `${p.status.toUpperCase()} ${p.name}: ${p.evidence}`),
    ...event.approvals.map((a) => `${a.status.toUpperCase()} by ${a.reviewerRole}: ${a.evidence}`),
  ]);

  return {
    title: "ComplyTrace synthetic audit evidence pack",
    summary,
    highRiskCount: highRisk.length,
    evidence,
    dataMinimizationStatement:
      "Evidence pack contains synthetic metadata, policy decisions, redaction classifications, approvals, model identifiers, and retention settings only. It excludes raw prompts, customer financial records, account numbers, and confidential payloads.",
    recommendation:
      highRisk.length > 0
        ? "Resolve failed policy checks or pending approvals before production release."
        : "No high-risk traces in this sample evidence pack; continue periodic review and retention monitoring.",
  };
}

export type AgentEventType =
  | "agent_run_started"
  | "model_call_completed"
  | "tool_call_completed"
  | "policy_check_completed"
  | "redaction_completed"
  | "human_approval_requested"
  | "human_approval_completed"
  | "agent_run_completed"
  | "agent_run_failed";

export type AgentEventSeverity = "info" | "success" | "warning" | "critical";

export type AgentEvent = {
  id: string;
  type: AgentEventType;
  timestamp: string;
  summary: string;
  severity: AgentEventSeverity;
  model?: string;
  toolName?: string;
  policyId?: string;
  policyDecision?: "allow" | "block" | "escalate";
  piiDetected?: number;
  redacted?: boolean;
  reviewer?: string;
  promptHash?: string;
  outputHash?: string;
};

export type AgentTrace = {
  id: string;
  agentName: string;
  environment: "sandbox" | "staging" | "production-shadow" | "production";
  startedAt: string;
  completedAt?: string;
  dataMode: "metadata_only" | "redacted_payload" | "raw_payload";
  events: AgentEvent[];
};

export type RedactionPosture = "protected" | "not_applicable" | "unsafe";
export type RiskLabel = "low" | "medium" | "high" | "critical";

export function classifyRedactionPosture(trace: AgentTrace): RedactionPosture {
  const redactionEvents = trace.events.filter((event) => event.type === "redaction_completed");
  const piiDetected = redactionEvents.reduce((count, event) => count + (event.piiDetected ?? 0), 0);
  const failedRedaction = redactionEvents.some((event) => event.piiDetected && !event.redacted);

  if (failedRedaction || trace.dataMode === "raw_payload") return "unsafe";
  if (piiDetected > 0 && redactionEvents.every((event) => event.redacted !== false)) return "protected";
  return "not_applicable";
}

export function scoreTraceRisk(trace: AgentTrace): { score: number; label: RiskLabel } {
  let score = 15;
  const hasEscalation = trace.events.some(
    (event) => event.type === "policy_check_completed" && event.policyDecision === "escalate",
  );
  const hasBlock = trace.events.some((event) => event.type === "policy_check_completed" && event.policyDecision === "block");
  const hasHumanApproval = trace.events.some((event) => event.type === "human_approval_completed");
  const redactionPosture = classifyRedactionPosture(trace);

  if (hasEscalation) score += 25;
  if (hasBlock) score += 40;
  if ((hasEscalation || hasBlock) && !hasHumanApproval) score += 25;
  if (redactionPosture === "unsafe") score += 35;
  if (trace.dataMode === "metadata_only") score -= 5;

  const normalized = Math.max(0, Math.min(100, score));
  const label: RiskLabel = normalized >= 90 ? "critical" : normalized >= 65 ? "high" : normalized >= 30 ? "medium" : "low";
  return { score: normalized, label };
}

export function summarizeTrace(trace: AgentTrace) {
  const risk = scoreTraceRisk(trace);
  return {
    traceId: trace.id,
    agentName: trace.agentName,
    dataMode: trace.dataMode,
    totalEvents: trace.events.length,
    modelCalls: trace.events.filter((event) => event.type === "model_call_completed").length,
    toolCalls: trace.events.filter((event) => event.type === "tool_call_completed").length,
    policyChecks: trace.events.filter((event) => event.type === "policy_check_completed").length,
    escalations: trace.events.filter((event) => event.policyDecision === "escalate").length,
    humanApprovals: trace.events.filter((event) => event.type === "human_approval_completed").length,
    redactionPosture: classifyRedactionPosture(trace),
    riskScore: risk.score,
    riskLabel: risk.label,
  };
}

export function createAuditReport(trace: AgentTrace) {
  const summary = summarizeTrace(trace);
  const policyIds = trace.events
    .filter((event) => event.type === "policy_check_completed" && event.policyId)
    .map((event) => event.policyId as string);
  const escalatedPolicies = trace.events.filter((event) => event.policyDecision === "escalate" && event.policyId);

  const evidenceChecklist = [
    trace.dataMode === "metadata_only" ? "Metadata-only mode enabled" : "Review non-metadata data mode",
    trace.events.some((event) => event.promptHash && event.outputHash)
      ? "Prompt/output hashes captured"
      : "Prompt/output hashes missing",
    summary.humanApprovals > 0 ? "Human approval recorded" : "Human approval missing",
    summary.redactionPosture === "protected" ? "PII redaction evidence captured" : "No PII redaction evidence required",
  ];

  return {
    title: `Audit evidence report for ${trace.agentName}`,
    executiveSummary: `${trace.agentName} ran in ${trace.environment} with ${summary.totalEvents} recorded metadata events, ${summary.policyChecks} policy checks, ${summary.humanApprovals} human approvals, and a ${summary.riskLabel} risk rating.`,
    traceSummary: summary,
    policiesEvaluated: Array.from(new Set(policyIds)),
    evidenceChecklist,
    recommendedActions: escalatedPolicies.map(
      (event) => `Review escalation threshold tuning for ${event.policyId}.`,
    ),
    dataMinimizationStatement:
      "This report is generated from synthetic metadata, hashes, policy decisions, redaction classifications, and approval records. It does not require raw prompts, customer financial records, KYC documents, or transaction payloads.",
  };
}
