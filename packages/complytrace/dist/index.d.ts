export type ComplianceEnvironment = "sandbox" | "staging" | "production-shadow" | "production";
export type ComplianceDataMode = "metadata_only" | "redacted_payload" | "raw_payload";
export type ComplianceDecision = "allow" | "block" | "escalate";
export type RiskSeverity = "low" | "medium" | "high" | "critical";
export type TraceEventType = "agent_run_started" | "model_call_completed" | "tool_call_completed" | "policy_check_completed" | "redaction_completed" | "human_approval_completed" | "agent_run_completed" | "agent_run_failed";
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
export declare class InMemoryTraceStore implements TraceStore {
    private packets;
    save(packet: ComplianceAuditPacket): Promise<void>;
    listTraces(): Promise<ComplianceAuditPacket[]>;
}
export declare class ComplyTrace {
    private readonly options;
    private readonly policies;
    constructor(options: ComplyTraceOptions);
    startTrace(workflow: string, metadata?: Record<string, unknown>): ActiveComplianceTrace;
    trace<T>(workflow: string, fn: (trace: ActiveComplianceTrace) => Promise<T> | T, metadata?: Record<string, unknown>): Promise<T>;
}
export declare class ActiveComplianceTrace {
    private readonly config;
    readonly record: ComplianceTraceRecord;
    constructor(config: {
        app: string;
        workflow: string;
        environment: ComplianceEnvironment;
        dataMode: ComplianceDataMode;
        policies: Map<string, CompliancePolicy>;
        store?: TraceStore;
        metadata: Record<string, unknown>;
    });
    modelCall(provider: string, model: string, input: {
        prompt?: unknown;
        output?: unknown;
        metadata?: Record<string, unknown>;
    }): {
        promptHash: string;
        outputHash: string;
        redaction: RedactionResult;
    };
    toolCall(toolName: string, operation: string, input: unknown, metadata?: Record<string, unknown>): RedactionResult;
    redaction(label: string, input: unknown): RedactionResult;
    policyCheck(policyId: string, input: Partial<PolicyEvaluationInput> | PolicyEvaluation): PolicyEvaluation;
    humanApproval(reviewerRole: string, decision: "approved" | "rejected" | "pending", evidenceRef: string): void;
    finish(resultSummary: string): void;
    fail(reason: string): void;
    toAuditPacket(): Promise<ComplianceAuditPacket>;
    persist(): Promise<ComplianceAuditPacket>;
    private addEvent;
}
export declare function createComplianceTrace(options: ComplyTraceOptions): ComplyTrace;
export declare function redactSensitive(input: unknown): RedactionResult;
export declare function buildHashChain(events: ComplianceTraceEvent[]): EvidenceEvent[];
export declare function verifyHashChain(events: EvidenceEvent[]): {
    valid: true;
} | {
    valid: false;
    brokenAt: string;
};
export declare function summarizeComplianceTrace(trace: ComplianceTraceRecord): TraceSummary;
export declare function createComplianceAuditReport(trace: ComplianceTraceRecord, evidenceEvents?: EvidenceEvent[]): ComplianceAuditReport;
//# sourceMappingURL=index.d.ts.map