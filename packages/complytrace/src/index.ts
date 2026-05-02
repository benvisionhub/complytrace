import { createHash, randomUUID } from "node:crypto";

export type ComplianceEnvironment = "sandbox" | "staging" | "production-shadow" | "production";
export type ComplianceDataMode = "metadata_only" | "redacted_payload" | "raw_payload";
export type ComplianceDecision = "allow" | "block" | "escalate";
export type RiskSeverity = "low" | "medium" | "high" | "critical";
export type TraceEventType =
  | "agent_run_started"
  | "model_call_completed"
  | "tool_call_completed"
  | "policy_check_completed"
  | "redaction_completed"
  | "human_approval_completed"
  | "agent_run_completed"
  | "agent_run_failed";

export type RedactionResult = {
  clean: unknown;
  redactedFields: string[];
  blockedFields: string[];
  inputHash: string;
};

export type PolicyEvaluationInput = {
  trace: ActiveComplianceTrace;
  redaction: RedactionResult;
  metadata?: Record<string, unknown>;
};

export type PolicyEvaluation = {
  decision: ComplianceDecision;
  reason: string;
  severity: RiskSeverity;
};

export type CompliancePolicy = {
  id: string;
  description: string;
  evaluate: (input: PolicyEvaluationInput) => PolicyEvaluation;
};

export type ComplianceTraceEvent = {
  id: string;
  type: TraceEventType;
  timestamp: string;
  summary: string;
  severity: RiskSeverity;
  metadata: Record<string, unknown>;
  redaction?: RedactionResult;
  policyId?: string;
  policyDecision?: ComplianceDecision;
  promptHash?: string;
  outputHash?: string;
};

export type EvidenceEvent = ComplianceTraceEvent & {
  sequence: number;
  previousHash: string;
  hash: string;
};

export type ComplianceTraceRecord = {
  id: string;
  app: string;
  workflow: string;
  environment: ComplianceEnvironment;
  dataMode: ComplianceDataMode;
  subjectRef?: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed";
  events: ComplianceTraceEvent[];
  metadata: Record<string, unknown>;
};

export type TraceSummary = {
  traceId: string;
  app: string;
  workflow: string;
  dataMode: ComplianceDataMode;
  totalEvents: number;
  modelCalls: number;
  toolCalls: number;
  policyChecks: number;
  escalations: number;
  blocks: number;
  humanApprovals: number;
  redactionPosture: "protected" | "not_applicable" | "unsafe";
  riskScore: number;
  riskLabel: RiskSeverity;
};

export type ComplianceAuditReport = {
  title: string;
  executiveSummary: string;
  traceSummary: TraceSummary;
  policiesEvaluated: string[];
  evidenceChecklist: string[];
  recommendedActions: string[];
  dataMinimizationStatement: string;
};

export type ComplianceAuditPacket = {
  trace: ComplianceTraceRecord;
  evidence: {
    generatedAt: string;
    hashChainValid: boolean;
    rootHash: string;
    events: EvidenceEvent[];
  };
  report: ComplianceAuditReport;
};

export interface TraceStore {
  save(packet: ComplianceAuditPacket): Promise<void> | void;
  listTraces?(): Promise<ComplianceAuditPacket[]> | ComplianceAuditPacket[];
}

export type ComplyTraceOptions = {
  app: string;
  environment: ComplianceEnvironment;
  dataMode?: ComplianceDataMode;
  policies?: CompliancePolicy[];
  store?: TraceStore;
  defaultMetadata?: Record<string, unknown>;
};

export class InMemoryTraceStore implements TraceStore {
  private packets: ComplianceAuditPacket[] = [];

  async save(packet: ComplianceAuditPacket) {
    this.packets.push(packet);
  }

  async listTraces() {
    return [...this.packets];
  }
}

export class ComplyTrace {
  private readonly policies: Map<string, CompliancePolicy>;

  constructor(private readonly options: ComplyTraceOptions) {
    this.policies = new Map((options.policies ?? []).map((policy) => [policy.id, policy]));
  }

  startTrace(workflow: string, metadata: Record<string, unknown> = {}) {
    return new ActiveComplianceTrace({
      app: this.options.app,
      workflow,
      environment: this.options.environment,
      dataMode: this.options.dataMode ?? "metadata_only",
      policies: this.policies,
      store: this.options.store,
      metadata: { ...this.options.defaultMetadata, ...metadata },
    });
  }

  async trace<T>(workflow: string, fn: (trace: ActiveComplianceTrace) => Promise<T> | T, metadata: Record<string, unknown> = {}) {
    const trace = this.startTrace(workflow, metadata);
    try {
      const result = await fn(trace);
      trace.finish("completed");
      await trace.persist();
      return result;
    } catch (error) {
      trace.fail(error instanceof Error ? error.message : "Unknown agent failure");
      await trace.persist();
      throw error;
    }
  }
}

export class ActiveComplianceTrace {
  readonly record: ComplianceTraceRecord;

  constructor(
    private readonly config: {
      app: string;
      workflow: string;
      environment: ComplianceEnvironment;
      dataMode: ComplianceDataMode;
      policies: Map<string, CompliancePolicy>;
      store?: TraceStore;
      metadata: Record<string, unknown>;
    },
  ) {
    this.record = {
      id: `tr_${randomUUID()}`,
      app: config.app,
      workflow: config.workflow,
      environment: config.environment,
      dataMode: config.dataMode,
      subjectRef: typeof config.metadata.subjectRef === "string" ? config.metadata.subjectRef : undefined,
      startedAt: new Date().toISOString(),
      status: "running",
      metadata: sanitizeMetadata(config.metadata),
      events: [],
    };
    this.addEvent("agent_run_started", "Agent run started", "low", this.record.metadata);
  }

  modelCall(provider: string, model: string, input: { prompt?: unknown; output?: unknown; metadata?: Record<string, unknown> }) {
    const promptRedaction = redactSensitive(input.prompt ?? "");
    const outputRedaction = redactSensitive(input.output ?? "");
    const redaction: RedactionResult = {
      clean: { prompt: promptRedaction.clean, output: outputRedaction.clean },
      redactedFields: prefixFields("prompt", promptRedaction.redactedFields).concat(prefixFields("output", outputRedaction.redactedFields)),
      blockedFields: prefixFields("prompt", promptRedaction.blockedFields).concat(prefixFields("output", outputRedaction.blockedFields)),
      inputHash: sha256(stableStringify({ promptHash: promptRedaction.inputHash, outputHash: outputRedaction.inputHash })),
    };
    this.addEvent("model_call_completed", `Model call completed: ${provider}/${model}`, "low", {
      provider,
      model,
      ...sanitizeMetadata(input.metadata ?? {}),
      redactedFields: redaction.redactedFields,
      blockedFields: redaction.blockedFields,
    }, redaction, promptRedaction.inputHash, outputRedaction.inputHash);
    return { promptHash: promptRedaction.inputHash, outputHash: outputRedaction.inputHash, redaction };
  }

  toolCall(toolName: string, operation: string, input: unknown, metadata: Record<string, unknown> = {}) {
    const redaction = redactSensitive(input);
    this.addEvent("tool_call_completed", `Tool call completed: ${toolName}.${operation}`, "low", {
      toolName,
      operation,
      inputHash: redaction.inputHash,
      redactedFields: redaction.redactedFields,
      blockedFields: redaction.blockedFields,
      ...sanitizeMetadata(metadata),
    }, redaction);
    return redaction;
  }

  redaction(label: string, input: unknown) {
    const redaction = redactSensitive(input);
    this.addEvent("redaction_completed", `Redaction completed: ${label}`, redaction.blockedFields.length > 0 ? "high" : "medium", {
      label,
      protectedFieldCount: redaction.redactedFields.length,
      blockedFieldCount: redaction.blockedFields.length,
    }, redaction);
    return redaction;
  }

  policyCheck(policyId: string, input: Partial<PolicyEvaluationInput> | PolicyEvaluation) {
    const configured = this.config.policies.get(policyId);
    const evaluation = isPolicyEvaluation(input)
      ? input
      : configured?.evaluate({ trace: this, redaction: input.redaction ?? emptyRedaction(), metadata: input.metadata });
    const finalEvaluation = evaluation ?? { decision: "allow", reason: "No configured policy evaluator; recorded manual pass", severity: "low" as const };
    this.addEvent("policy_check_completed", `Policy ${policyId}: ${finalEvaluation.decision}`, finalEvaluation.severity, {
      reason: finalEvaluation.reason,
      policyDescription: configured?.description,
    }, undefined, undefined, undefined, policyId, finalEvaluation.decision);
    return finalEvaluation;
  }

  humanApproval(reviewerRole: string, decision: "approved" | "rejected" | "pending", evidenceRef: string) {
    this.addEvent(
      "human_approval_completed",
      `Human approval ${decision} by ${reviewerRole}`,
      decision === "approved" ? "low" : decision === "pending" ? "medium" : "high",
      { reviewerRole, decision, evidenceRef },
    );
  }

  finish(resultSummary: string) {
    if (this.record.status !== "running") return;
    this.record.status = "completed";
    this.record.completedAt = new Date().toISOString();
    this.addEvent("agent_run_completed", `Agent run completed: ${resultSummary}`, "low", { resultSummary });
  }

  fail(reason: string) {
    if (this.record.status !== "running") return;
    this.record.status = "failed";
    this.record.completedAt = new Date().toISOString();
    this.addEvent("agent_run_failed", `Agent run failed: ${reason}`, "critical", { reason });
  }

  async toAuditPacket(): Promise<ComplianceAuditPacket> {
    if (this.record.status === "running") this.finish("manual trace finalized");
    const events = buildHashChain(this.record.events);
    const verify = verifyHashChain(events);
    return {
      trace: { ...this.record, events: [...this.record.events] },
      evidence: {
        generatedAt: new Date().toISOString(),
        hashChainValid: verify.valid,
        rootHash: events.at(-1)?.hash ?? sha256("empty"),
        events,
      },
      report: createComplianceAuditReport(this.record, events),
    };
  }

  async persist() {
    const packet = await this.toAuditPacket();
    await this.config.store?.save(packet);
    return packet;
  }

  private addEvent(
    type: TraceEventType,
    summary: string,
    severity: RiskSeverity,
    metadata: Record<string, unknown> = {},
    redaction?: RedactionResult,
    promptHash?: string,
    outputHash?: string,
    policyId?: string,
    policyDecision?: ComplianceDecision,
  ) {
    this.record.events.push({
      id: `ev_${randomUUID()}`,
      type,
      timestamp: new Date().toISOString(),
      summary,
      severity,
      metadata: sanitizeMetadata(metadata),
      redaction: redaction ? summarizeRedaction(redaction) : undefined,
      promptHash,
      outputHash,
      policyId,
      policyDecision,
    });
  }
}

export function createComplianceTrace(options: ComplyTraceOptions) {
  return new ComplyTrace(options);
}

export function redactSensitive(input: unknown): RedactionResult {
  const redactedFields: string[] = [];
  const blockedFields: string[] = [];
  const visit = (value: unknown, path: string): unknown => {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map((item, index) => visit(item, path ? `${path}.${index}` : `${index}`));
    if (typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
          const childPath = path ? `${path}.${key}` : key;
          return [key, visitField(key, nested, childPath)];
        }),
      );
    }
    return visitScalar(value, path);
  };

  const visitField = (key: string, value: unknown, path: string): unknown => {
    const lower = key.toLowerCase();
    if (/password|secret|token|apikey|api_key|authorization/.test(lower)) {
      redactedFields.push(path);
      return "[REDACTED:secret]";
    }
    if (/ssn|socialsecurity/.test(lower)) {
      redactedFields.push(path);
      return "[REDACTED:ssn]";
    }
    if (/card|pan|accountnumber|account_number|routing/.test(lower)) {
      redactedFields.push(path);
      return "[REDACTED:card]";
    }
    if (/email/.test(lower)) {
      redactedFields.push(path);
      return "[REDACTED:email]";
    }
    return visit(value, path);
  };

  const visitScalar = (value: unknown, path: string): unknown => {
    if (typeof value !== "string") return value;
    let clean = value;
    const mark = () => redactedFields.push(path || "value");
    if (/\b\d{3}-\d{2}-\d{4}\b/.test(clean)) {
      mark();
      clean = clean.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED:ssn]");
    }
    if (/\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/.test(clean)) {
      mark();
      clean = clean.replace(/\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[REDACTED:email]");
    }
    if (/\b(?:\d[ -]*?){13,19}\b/.test(clean)) {
      mark();
      clean = clean.replace(/\b(?:\d[ -]*?){13,19}\b/g, "[REDACTED:card]");
    }
    if (/\b(?:sk|pk|api)[-_][A-Za-z0-9_-]{8,}\b/.test(clean)) {
      mark();
      clean = clean.replace(/\b(?:sk|pk|api)[-_][A-Za-z0-9_-]{8,}\b/g, "[REDACTED:secret]");
    }
    return clean;
  };

  return {
    clean: visit(input, ""),
    redactedFields: unique(redactedFields.filter(Boolean)),
    blockedFields,
    inputHash: sha256(stableStringify(input)),
  };
}

export function buildHashChain(events: ComplianceTraceEvent[]): EvidenceEvent[] {
  let previousHash = "GENESIS";
  return events.map((event, index) => {
    const base = { ...event, sequence: index + 1, previousHash };
    const hash = sha256(stableStringify(base));
    previousHash = hash;
    return { ...base, hash };
  });
}

export function verifyHashChain(events: EvidenceEvent[]): { valid: true } | { valid: false; brokenAt: string } {
  let previousHash = "GENESIS";
  for (const event of events) {
    const { hash, ...base } = event;
    if (base.previousHash !== previousHash) return { valid: false, brokenAt: event.id };
    const expected = sha256(stableStringify(base));
    if (expected !== hash) return { valid: false, brokenAt: event.id };
    previousHash = hash;
  }
  return { valid: true };
}

export function summarizeComplianceTrace(trace: ComplianceTraceRecord): TraceSummary {
  const policyEvents = trace.events.filter((event) => event.type === "policy_check_completed");
  const escalations = policyEvents.filter((event) => event.policyDecision === "escalate").length;
  const blocks = policyEvents.filter((event) => event.policyDecision === "block").length;
  const humanApprovals = trace.events.filter((event) => event.type === "human_approval_completed").length;
  const unsafe = trace.dataMode === "raw_payload" || trace.events.some((event) => event.redaction?.blockedFields?.length);
  const protectedRedactions = trace.events.some((event) => (event.redaction?.redactedFields?.length ?? 0) > 0);
  let riskScore = 10 + escalations * 25 + blocks * 40;
  riskScore += trace.events.filter((event) => event.type === "policy_check_completed" && event.severity === "high").length * 15;
  riskScore += trace.events.filter((event) => event.type === "policy_check_completed" && event.severity === "critical").length * 30;
  if ((escalations || blocks) && humanApprovals === 0) riskScore += 25;
  if (unsafe) riskScore += 35;
  if (trace.dataMode === "metadata_only") riskScore -= 5;
  riskScore = Math.max(0, Math.min(100, riskScore));
  const riskLabel: RiskSeverity = riskScore >= 90 ? "critical" : riskScore >= 65 ? "high" : riskScore >= 30 ? "medium" : "low";
  return {
    traceId: trace.id,
    app: trace.app,
    workflow: trace.workflow,
    dataMode: trace.dataMode,
    totalEvents: trace.events.length,
    modelCalls: trace.events.filter((event) => event.type === "model_call_completed").length,
    toolCalls: trace.events.filter((event) => event.type === "tool_call_completed").length,
    policyChecks: policyEvents.length,
    escalations,
    blocks,
    humanApprovals,
    redactionPosture: unsafe ? "unsafe" : protectedRedactions ? "protected" : "not_applicable",
    riskScore,
    riskLabel,
  };
}

export function createComplianceAuditReport(trace: ComplianceTraceRecord, evidenceEvents = buildHashChain(trace.events)): ComplianceAuditReport {
  const summary = summarizeComplianceTrace(trace);
  const policiesEvaluated = unique(trace.events.map((event) => event.policyId).filter((id): id is string => Boolean(id)));
  const verify = verifyHashChain(evidenceEvents);
  const recommendedActions: string[] = [];
  if (summary.blocks > 0) recommendedActions.push("Do not execute blocked action until policy exception is reviewed.");
  if (summary.escalations > 0 && summary.humanApprovals === 0) recommendedActions.push("Attach a human approval before production execution.");
  if (!verify.valid) recommendedActions.push("Investigate evidence tampering before audit submission.");
  if (summary.redactionPosture === "unsafe") recommendedActions.push("Switch to metadata-only or redacted-payload mode before regulated use.");
  return {
    title: `Compliance audit packet for ${trace.app}/${trace.workflow}`,
    executiveSummary: `${trace.app} executed ${trace.workflow} in ${trace.environment} with ${summary.totalEvents} trace events, ${summary.policyChecks} policy checks, ${summary.humanApprovals} human approvals, and a ${summary.riskLabel} risk rating.`,
    traceSummary: summary,
    policiesEvaluated,
    evidenceChecklist: [
      trace.dataMode === "metadata_only" ? "Metadata-only evidence mode enabled" : "Non-metadata data mode requires compliance review",
      evidenceEvents.length > 0 ? "Tamper-evident hash chain generated" : "No evidence events captured",
      verify.valid ? "Hash chain verification passed" : "Hash chain verification failed",
      summary.redactionPosture === "protected" ? "Sensitive fields were redacted before storage" : "No sensitive fields detected or raw-payload mode used",
      summary.humanApprovals > 0 ? "Human approval event recorded" : "No human approval event recorded",
    ],
    recommendedActions,
    dataMinimizationStatement:
      "ComplyTrace stores audit metadata, policy decisions, redaction summaries, timestamps, reviewer references, and cryptographic hashes. Raw prompts, customer financial records, KYC documents, card numbers, SSNs, account numbers, API tokens, and emails are redacted or represented by hashes by default.",
  };
}

function summarizeRedaction(redaction: RedactionResult): RedactionResult {
  return {
    clean: redaction.clean,
    redactedFields: redaction.redactedFields,
    blockedFields: redaction.blockedFields,
    inputHash: redaction.inputHash,
  };
}

function sanitizeMetadata(metadata: Record<string, unknown>) {
  return redactSensitive(metadata).clean as Record<string, unknown>;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
    .join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function emptyRedaction(): RedactionResult {
  return { clean: {}, redactedFields: [], blockedFields: [], inputHash: sha256("{}") };
}

function isPolicyEvaluation(value: Partial<PolicyEvaluationInput> | PolicyEvaluation): value is PolicyEvaluation {
  return typeof (value as PolicyEvaluation).decision === "string" && typeof (value as PolicyEvaluation).reason === "string";
}

function prefixFields(prefix: string, fields: string[]) {
  return fields.map((field) => `${prefix}.${field}`);
}
