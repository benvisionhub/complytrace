import { createHash, randomUUID } from "node:crypto";
export class InMemoryTraceStore {
    packets = [];
    async save(packet) {
        this.packets.push(packet);
    }
    async listTraces() {
        return [...this.packets];
    }
}
export class ComplyTrace {
    options;
    policies;
    constructor(options) {
        this.options = options;
        this.policies = new Map((options.policies ?? []).map((policy) => [policy.id, policy]));
    }
    startTrace(workflow, metadata = {}) {
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
    async trace(workflow, fn, metadata = {}) {
        const trace = this.startTrace(workflow, metadata);
        try {
            const result = await fn(trace);
            trace.finish("completed");
            await trace.persist();
            return result;
        }
        catch (error) {
            trace.fail(error instanceof Error ? error.message : "Unknown agent failure");
            await trace.persist();
            throw error;
        }
    }
}
export class ActiveComplianceTrace {
    config;
    record;
    constructor(config) {
        this.config = config;
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
    modelCall(provider, model, input) {
        const promptRedaction = redactSensitive(input.prompt ?? "");
        const outputRedaction = redactSensitive(input.output ?? "");
        const redaction = {
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
    toolCall(toolName, operation, input, metadata = {}) {
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
    redaction(label, input) {
        const redaction = redactSensitive(input);
        this.addEvent("redaction_completed", `Redaction completed: ${label}`, redaction.blockedFields.length > 0 ? "high" : "medium", {
            label,
            protectedFieldCount: redaction.redactedFields.length,
            blockedFieldCount: redaction.blockedFields.length,
        }, redaction);
        return redaction;
    }
    policyCheck(policyId, input) {
        const configured = this.config.policies.get(policyId);
        const evaluation = isPolicyEvaluation(input)
            ? input
            : configured?.evaluate({ trace: this, redaction: input.redaction ?? emptyRedaction(), metadata: input.metadata });
        const finalEvaluation = evaluation ?? { decision: "allow", reason: "No configured policy evaluator; recorded manual pass", severity: "low" };
        this.addEvent("policy_check_completed", `Policy ${policyId}: ${finalEvaluation.decision}`, finalEvaluation.severity, {
            reason: finalEvaluation.reason,
            policyDescription: configured?.description,
        }, undefined, undefined, undefined, policyId, finalEvaluation.decision);
        return finalEvaluation;
    }
    humanApproval(reviewerRole, decision, evidenceRef) {
        this.addEvent("human_approval_completed", `Human approval ${decision} by ${reviewerRole}`, decision === "approved" ? "low" : decision === "pending" ? "medium" : "high", { reviewerRole, decision, evidenceRef });
    }
    finish(resultSummary) {
        if (this.record.status !== "running")
            return;
        this.record.status = "completed";
        this.record.completedAt = new Date().toISOString();
        this.addEvent("agent_run_completed", `Agent run completed: ${resultSummary}`, "low", { resultSummary });
    }
    fail(reason) {
        if (this.record.status !== "running")
            return;
        this.record.status = "failed";
        this.record.completedAt = new Date().toISOString();
        this.addEvent("agent_run_failed", `Agent run failed: ${reason}`, "critical", { reason });
    }
    async toAuditPacket() {
        if (this.record.status === "running")
            this.finish("manual trace finalized");
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
    addEvent(type, summary, severity, metadata = {}, redaction, promptHash, outputHash, policyId, policyDecision) {
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
export function createComplianceTrace(options) {
    return new ComplyTrace(options);
}
export function redactSensitive(input) {
    const redactedFields = [];
    const blockedFields = [];
    const visit = (value, path) => {
        if (value === null || value === undefined)
            return value;
        if (Array.isArray(value))
            return value.map((item, index) => visit(item, path ? `${path}.${index}` : `${index}`));
        if (typeof value === "object") {
            return Object.fromEntries(Object.entries(value).map(([key, nested]) => {
                const childPath = path ? `${path}.${key}` : key;
                return [key, visitField(key, nested, childPath)];
            }));
        }
        return visitScalar(value, path);
    };
    const visitField = (key, value, path) => {
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
    const visitScalar = (value, path) => {
        if (typeof value !== "string")
            return value;
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
export function buildHashChain(events) {
    let previousHash = "GENESIS";
    return events.map((event, index) => {
        const base = { ...event, sequence: index + 1, previousHash };
        const hash = sha256(stableStringify(base));
        previousHash = hash;
        return { ...base, hash };
    });
}
export function verifyHashChain(events) {
    let previousHash = "GENESIS";
    for (const event of events) {
        const { hash, ...base } = event;
        if (base.previousHash !== previousHash)
            return { valid: false, brokenAt: event.id };
        const expected = sha256(stableStringify(base));
        if (expected !== hash)
            return { valid: false, brokenAt: event.id };
        previousHash = hash;
    }
    return { valid: true };
}
export function summarizeComplianceTrace(trace) {
    const policyEvents = trace.events.filter((event) => event.type === "policy_check_completed");
    const escalations = policyEvents.filter((event) => event.policyDecision === "escalate").length;
    const blocks = policyEvents.filter((event) => event.policyDecision === "block").length;
    const humanApprovals = trace.events.filter((event) => event.type === "human_approval_completed").length;
    const unsafe = trace.dataMode === "raw_payload" || trace.events.some((event) => event.redaction?.blockedFields?.length);
    const protectedRedactions = trace.events.some((event) => (event.redaction?.redactedFields?.length ?? 0) > 0);
    let riskScore = 10 + escalations * 25 + blocks * 40;
    riskScore += trace.events.filter((event) => event.type === "policy_check_completed" && event.severity === "high").length * 15;
    riskScore += trace.events.filter((event) => event.type === "policy_check_completed" && event.severity === "critical").length * 30;
    if ((escalations || blocks) && humanApprovals === 0)
        riskScore += 25;
    if (unsafe)
        riskScore += 35;
    if (trace.dataMode === "metadata_only")
        riskScore -= 5;
    riskScore = Math.max(0, Math.min(100, riskScore));
    const riskLabel = riskScore >= 90 ? "critical" : riskScore >= 65 ? "high" : riskScore >= 30 ? "medium" : "low";
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
export function createComplianceAuditReport(trace, evidenceEvents = buildHashChain(trace.events)) {
    const summary = summarizeComplianceTrace(trace);
    const policiesEvaluated = unique(trace.events.map((event) => event.policyId).filter((id) => Boolean(id)));
    const verify = verifyHashChain(evidenceEvents);
    const recommendedActions = [];
    if (summary.blocks > 0)
        recommendedActions.push("Do not execute blocked action until policy exception is reviewed.");
    if (summary.escalations > 0 && summary.humanApprovals === 0)
        recommendedActions.push("Attach a human approval before production execution.");
    if (!verify.valid)
        recommendedActions.push("Investigate evidence tampering before audit submission.");
    if (summary.redactionPosture === "unsafe")
        recommendedActions.push("Switch to metadata-only or redacted-payload mode before regulated use.");
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
        dataMinimizationStatement: "ComplyTrace stores audit metadata, policy decisions, redaction summaries, timestamps, reviewer references, and cryptographic hashes. Raw prompts, customer financial records, KYC documents, card numbers, SSNs, account numbers, API tokens, and emails are redacted or represented by hashes by default.",
    };
}
function summarizeRedaction(redaction) {
    return {
        clean: redaction.clean,
        redactedFields: redaction.redactedFields,
        blockedFields: redaction.blockedFields,
        inputHash: redaction.inputHash,
    };
}
function sanitizeMetadata(metadata) {
    return redactSensitive(metadata).clean;
}
function stableStringify(value) {
    if (value === null || typeof value !== "object")
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(stableStringify).join(",")}]`;
    return `{${Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
        .join(",")}}`;
}
function sha256(value) {
    return createHash("sha256").update(value).digest("hex");
}
function unique(items) {
    return Array.from(new Set(items));
}
function emptyRedaction() {
    return { clean: {}, redactedFields: [], blockedFields: [], inputHash: sha256("{}") };
}
function isPolicyEvaluation(value) {
    return typeof value.decision === "string" && typeof value.reason === "string";
}
function prefixFields(prefix, fields) {
    return fields.map((field) => `${prefix}.${field}`);
}
